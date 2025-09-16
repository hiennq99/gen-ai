import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "@opensearch-project/opensearch";
import { BedrockService } from "../bedrock/bedrock.service";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Client;
  private indices: {
    documents: string;
    conversations: string;
  };

  constructor(
    private configService: ConfigService,
    private bedrockService: BedrockService,
    private databaseService: DatabaseService
  ) {
    const node = this.configService.get<string>("opensearch.node");
    const auth = this.configService.get("opensearch.auth");

    this.client = new Client({
      node,
      auth,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    this.indices = this.configService.get("opensearch.indices") || {
      documents: "documents",
      conversations: "conversations",
    };
  }

  async onModuleInit() {
    // Skip initialization if OpenSearch is not configured
    const node = this.configService.get<string>("opensearch.node");
    if (node && !node.includes('localhost')) {
      await this.initializeIndices();
    } else {
      this.logger.warn('OpenSearch not configured, using in-memory search');
    }
  }

  private async initializeIndices() {
    try {
      // Test connection first
      await this.client.ping();
      
      // Check and create documents index
      const documentsExists = await this.client.indices.exists({
        index: this.indices.documents,
      });

      if (!documentsExists.body) {
        await this.client.indices.create({
          index: this.indices.documents,
          body: {
            mappings: {
              properties: {
                documentId: { type: "keyword" },
                content: { type: "text" },
                embedding: {
                  type: "dense_vector",
                  dims: 1536,
                  index: true,
                  similarity: "cosine",
                },
                metadata: { type: "object" },
                createdAt: { type: "date" },
              },
            },
          },
        });
        this.logger.log(`Created index: ${this.indices.documents}`);
      }

      // Check and create conversations index
      const conversationsExists = await this.client.indices.exists({
        index: this.indices.conversations,
      });

      if (!conversationsExists.body) {
        await this.client.indices.create({
          index: this.indices.conversations,
          body: {
            mappings: {
              properties: {
                sessionId: { type: "keyword" },
                userId: { type: "keyword" },
                message: { type: "text" },
                response: { type: "text" },
                emotion: { type: "keyword" },
                timestamp: { type: "date" },
              },
            },
          },
        });
        this.logger.log(`Created index: ${this.indices.conversations}`);
      }
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
        this.logger.warn('OpenSearch is not available - search features will be limited');
      } else {
        this.logger.error("Error initializing indices:", error);
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Check if we should even try to generate embeddings
      const node = this.configService.get<string>("opensearch.node");
      if (!node || node.includes('localhost') || node.includes('your-opensearch-domain')) {
        // Return mock embedding for local development
        return Array.from({ length: 1536 }, () => Math.random());
      }

      // In production, you would use a proper embedding model
      // For now, skip calling Bedrock and just return mock embeddings
      // This avoids the dependency on Bedrock for search functionality
      
      // Generate a deterministic mock embedding based on text
      // This ensures same text gets same embedding
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      
      // Use hash to seed random embedding
      const embedding = Array.from({ length: 1536 }, (_, i) => {
        const seed = hash + i;
        return (Math.sin(seed) + 1) / 2; // Normalize to 0-1
      });
      
      return embedding;
    } catch (error) {
      this.logger.debug("Error generating embedding, using fallback:", error.message);
      // Return default embedding on error
      return Array.from({ length: 1536 }, () => 0);
    }
  }

  async indexDocument(document: any) {
    try {
      // Check if OpenSearch is available
      const node = this.configService.get<string>("opensearch.node");
      if (!node || node.includes('localhost')) {
        // Skip indexing if OpenSearch is not available
        this.logger.debug('Skipping document indexing - OpenSearch not available');
        return { indexed: false, reason: 'OpenSearch not configured' };
      }

      const response = await this.client.index({
        index: this.indices.documents,
        body: {
          ...document,
          createdAt: new Date().toISOString(),
        },
      });

      await this.client.indices.refresh({
        index: this.indices.documents,
      });

      return response.body;
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
        this.logger.debug('OpenSearch connection failed - skipping indexing');
        return { indexed: false, reason: 'OpenSearch unavailable' };
      }
      this.logger.error("Error indexing document:", error);
      // Don't throw, return error status instead
      return { indexed: false, error: error.message };
    }
  }

  async searchDocuments(params: {
    query: string;
    emotion?: string;
    limit?: number;
    minScore?: number;
    exactMatchFirst?: boolean;
  }) {
    const { query, emotion, limit = 10, minScore = 0.1, exactMatchFirst = true } = params;

    this.logger.log(`🔍 SEARCH DEBUG: Searching for: "${query}" with limit: ${limit}, minScore: ${minScore}, exactMatchFirst: ${exactMatchFirst}`);

    try {
      // Check if OpenSearch is available
      const node = this.configService.get<string>("opensearch.node");
      if (!node || node.includes('localhost') || node.includes('your-opensearch-domain')) {
        this.logger.debug('Using database fallback search');
        // Use database fallback for local development
        return await this.searchDocumentsFromDatabase(params);
      }

      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Build search query
      const searchBody = {
        size: limit,
        min_score: minScore,
        query: {
          bool: {
            should: [
              {
                match: {
                  content: {
                    query,
                    boost: 2,
                  },
                },
              },
              {
                script_score: {
                  query: { match_all: {} },
                  script: {
                    source:
                      "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                    params: {
                      query_vector: queryEmbedding,
                    },
                  },
                },
              },
            ],
          },
        },
      };

      // Add emotion boost if provided
      if (emotion) {
        searchBody.query.bool.should.push({
          term: {
            "metadata.emotion": emotion,
          },
        } as any);
      }

      const response = await this.client.search({
        index: this.indices.documents,
        body: searchBody,
      });

      return response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      }));
    } catch (error: any) {
      if (!error.message?.includes('ECONNREFUSED') && !error.message?.includes('ENOTFOUND')) {
        this.logger.error("Error searching documents:", error.message || error);
      }
      return [];
    }
  }

  async semanticSearch(query: string, options?: any) {
    try {
      const embedding = await this.generateEmbedding(query);

      const response = await this.client.search({
        index: this.indices.documents,
        body: {
          size: options?.limit || 10,
          query: {
            script_score: {
              query: { match_all: {} },
              script: {
                source:
                  "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                params: {
                  query_vector: embedding,
                },
              },
            },
          },
        },
      });

      return response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      }));
    } catch (error) {
      this.logger.error("Error in semantic search:", error);
      return [];
    }
  }

  // Fallback search method using database
  private async searchDocumentsFromDatabase(params: {
    query: string;
    emotion?: string;
    limit?: number;
    minScore?: number;
    exactMatchFirst?: boolean;
  }) {
    const { query, emotion, limit = 10, exactMatchFirst = true } = params;
    
    try {
      // First, try to find exact Q&A matches with emotion filtering
      if (exactMatchFirst) {
        this.logger.log(`🔍 DB DEBUG: Looking for exact Q&A match for: "${query}" with emotion: ${emotion}`);
        const exactMatch = await this.findExactQAMatch(query, emotion);
        if (exactMatch) {
          this.logger.log(`✅ DB DEBUG: Found Q&A match! Score: ${(exactMatch.score * 100).toFixed(1)}%, Type: ${exactMatch.metadata?.type}`);
          return [exactMatch];
        } else {
          this.logger.log(`❌ DB DEBUG: No exact Q&A match found for: "${query}"`);
        }
      }
      
      // Get all documents from database
      const documents = await this.databaseService.getAllDocuments();
      
      if (!documents || documents.length === 0) {
        this.logger.debug('No documents found in database');
        return [];
      }
      
      // Simple text matching for fallback
      const queryLower = query.toLowerCase();
      const scoredResults: any[] = [];
      
      for (const doc of documents) {
        if (doc.status !== 'processed' && doc.status !== 'completed') continue;
        
        // Try to get chunks for the document for better search
        const chunks = await this.databaseService.getDocumentChunks(doc.id);
        
        if (chunks && chunks.length > 0) {
          // Search in chunks
          for (const chunk of chunks) {
            const chunkText = (chunk.text || '').toLowerCase();
            let score = 0;
            const queryWords = queryLower.split(/\s+/);
            
            queryWords.forEach((word: string) => {
              if (chunkText.includes(word)) score += 2;
            });
            
            if (score > 0) {
              const normalizedScore = Math.min(score / (queryWords.length * 2), 1);
              scoredResults.push({
                ...doc,
                score: normalizedScore,
                documentId: doc.id,
                text: chunk.text,
                content: chunk.text,
                chunkIndex: chunk.chunkIndex,
              });
            }
          }
        } else {
          // Fallback to document content/preview
          const content = (doc.content || doc.text || doc.metadata?.contentPreview || '').toLowerCase();
          const title = (doc.title || doc.name || '').toLowerCase();
          
          let score = 0;
          const queryWords = queryLower.split(/\s+/);
          
          queryWords.forEach((word: string) => {
            if (content.includes(word)) score += 2;
            if (title.includes(word)) score += 3;
          });
          
          if (score > 0) {
            const normalizedScore = Math.min(score / (queryWords.length * 5), 1);
            scoredResults.push({
              ...doc,
              score: normalizedScore,
              documentId: doc.id,
              text: doc.content || doc.text || doc.metadata?.contentPreview,
              content: doc.content || doc.text || doc.metadata?.contentPreview,
            });
          }
        }
      }
      
      // Sort by score and limit results
      const topResults = scoredResults
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limit);
      
      this.logger.log(`Database fallback search found ${topResults.length} results for query: "${query}"`);
      
      // Log the first result for debugging
      if (topResults.length > 0) {
        this.logger.debug(`First result: score=${topResults[0].score}, text preview: ${topResults[0].text?.substring(0, 100)}`);
      }
      
      return topResults;
    } catch (error) {
      this.logger.error('Error in database fallback search:', error);
      return [];
    }
  }

  async deleteDocument(documentId: string) {
    try {
      // Check if OpenSearch is available
      const node = this.configService.get<string>("opensearch.node");
      if (!node || node.includes('localhost') || node.includes('your-opensearch-domain')) {
        this.logger.debug('Skipping document deletion - OpenSearch not configured');
        return { deleted: false, reason: 'OpenSearch not configured' };
      }

      await this.client.deleteByQuery({
        index: this.indices.documents,
        body: {
          query: {
            term: {
              documentId,
            },
          },
        },
      });

      await this.client.indices.refresh({
        index: this.indices.documents,
      });
      
      return { deleted: true };
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
        this.logger.debug('OpenSearch connection failed - skipping document deletion');
        return { deleted: false, reason: 'OpenSearch unavailable' };
      }
      this.logger.error("Error deleting document from search:", error);
      // Don't throw, return error status
      return { deleted: false, error: error.message };
    }
  }

  async indexConversation(conversation: any) {
    try {
      // Check if OpenSearch is available
      const node = this.configService.get<string>("opensearch.node");
      if (!node || node.includes('localhost')) {
        return { indexed: false, reason: 'OpenSearch not configured' };
      }

      const response = await this.client.index({
        index: this.indices.conversations,
        body: {
          ...conversation,
          timestamp: new Date().toISOString(),
        },
      });

      return response.body;
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
        this.logger.debug('OpenSearch connection failed - skipping conversation indexing');
        return { indexed: false, reason: 'OpenSearch unavailable' };
      }
      this.logger.error("Error indexing conversation:", error);
      return { indexed: false, error: error.message };
    }
  }

  // Find exact Q&A match with emotion filtering
  private async findExactQAMatch(query: string, emotion?: string): Promise<any> {
    try {
      // Get Q&A training data
      const qaData = await this.databaseService.getQAData();

      this.logger.log(`🔍 QA DEBUG: Retrieved ${qaData?.length || 0} Q&A items from database`);

      if (!qaData || qaData.length === 0) {
        this.logger.log(`❌ QA DEBUG: No Q&A data found in database!`);
        return null;
      }
      
      // Normalize query for comparison
      const normalizedQuery = this.normalizeText(query);
      
      // First, try to find matches with the same emotion
      let bestMatch = null;
      let bestScore = 0;
      
      this.logger.log(`🔍 QA DEBUG: Testing query "${normalizedQuery}" against ${qaData.length} Q&A items`);

      for (const qa of qaData) {
        const normalizedQuestion = this.normalizeText(qa.question || '');
        let score = 0;

        // Check for exact match
        if (normalizedQuestion === normalizedQuery) {
          score = 1.0;
          this.logger.log(`🎯 QA DEBUG: EXACT match! "${qa.question}" = 100%`);
        } else {
          // Check for high similarity match
          score = this.calculateSimilarity(normalizedQuery, normalizedQuestion);
          if (score > 0.5) {
            this.logger.log(`📊 QA DEBUG: High similarity "${qa.question}" = ${(score * 100).toFixed(1)}%`);
          }
        }
        
        // Apply emotion bonus if emotions match
        if (emotion && qa.emotion) {
          if (qa.emotion === emotion) {
            score *= 1.2; // 20% bonus for matching emotion
          } else if (this.areEmotionsRelated(qa.emotion, emotion)) {
            score *= 1.1; // 10% bonus for related emotions
          }
        }
        
        // Check if this is our best match so far - VERY LOW THRESHOLD TO ALWAYS FIND BEST MATCH
        const threshold = this.configService.get<number>('chat.exactMatch.threshold', 0.1);
        if (score >= threshold && score > bestScore) {
          bestScore = score;
          bestMatch = {
            documentId: qa.id,
            title: qa.question,
            content: qa.answer,
            text: qa.answer,
            score: Math.min(score, 1.0), // Cap at 1.0
            metadata: {
              type: score >= 0.95 ? 'qa_exact_match' : score >= 0.85 ? 'qa_semantic_high' : score >= 0.7 ? 'qa_semantic_medium' : score >= 0.5 ? 'qa_semantic_match' : score >= 0.3 ? 'qa_low_match' : 'qa_best_available',
              emotion: qa.emotion || 'neutral',
              category: qa.category || qa.metadata?.category || 'general',
              matchedQuestion: qa.question,
              emotionMatch: qa.emotion === emotion,
              semanticMatch: score >= 0.6,
            },
          };

          // Log when we find a potential 50%+ match
          if (score >= 0.5) {
            this.logger.log(`🎯 POTENTIAL 50%+ MATCH: "${qa.question}" = ${(score * 100).toFixed(1)}% (bestScore: ${bestScore})`);
          }
        }
      }

      // Force return of matches ≥50% (0.5) for training-only mode
      if (bestMatch && bestMatch.score >= 0.5) {
        this.logger.log(`🎯 DB DEBUG: Forcing return of 50%+ match: ${bestMatch.title} = ${(bestMatch.score * 100).toFixed(1)}%`);
        return bestMatch;
      }

      return bestMatch;
    } catch (error) {
      this.logger.error('Error finding exact Q&A match:', error);
      return null;
    }
  }
  
  // Check if emotions are related (for better matching)
  private areEmotionsRelated(emotion1: string, emotion2: string): boolean {
    const emotionGroups = {
      negative: ['sad', 'angry', 'fear', 'disgust', 'stressed'],
      positive: ['happy', 'grateful', 'excited'],
      confused: ['confused', 'uncertain'],
      neutral: ['neutral', 'calm'],
    };
    
    for (const group of Object.values(emotionGroups)) {
      if (group.includes(emotion1) && group.includes(emotion2)) {
        return true;
      }
    }
    
    return false;
  }

  // Normalize text for comparison
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Advanced semantic similarity calculation for meaning-based matching
  private calculateSimilarity(str1: string, str2: string): number {
    // First try exact match
    if (str1 === str2) return 1.0;

    // Normalize both strings
    const norm1 = this.normalizeForSemanticMatch(str1);
    const norm2 = this.normalizeForSemanticMatch(str2);

    if (norm1 === norm2) return 1.0;

    // Check for semantic similarity using multiple weighted approaches
    let totalScore = 0;
    let totalWeight = 0;

    // 1. Semantic core extraction (highest weight)
    const coreScore = this.calculateSemanticCoreMatch(norm1, norm2);
    totalScore += coreScore * 0.4;
    totalWeight += 0.4;

    // 2. Enhanced phrase similarity (high weight for emotional context)
    const phraseScore = this.calculateAdvancedPhraseSimilarity(norm1, norm2);
    totalScore += phraseScore * 0.3;
    totalWeight += 0.3;

    // 3. Contextual word matching (medium weight)
    const contextScore = this.calculateContextualWordMatch(norm1, norm2);
    totalScore += contextScore * 0.2;
    totalWeight += 0.2;

    // 4. Structure similarity (lower weight)
    const structureScore = this.calculateStructureSimilarity(norm1, norm2);
    totalScore += structureScore * 0.1;
    totalWeight += 0.1;

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    this.logger.debug(`Similarity calculation: "${str1}" vs "${str2}" = ${finalScore.toFixed(3)} (core: ${coreScore.toFixed(2)}, phrase: ${phraseScore.toFixed(2)}, context: ${contextScore.toFixed(2)}, structure: ${structureScore.toFixed(2)})`);

    return Math.min(finalScore, 1.0);
  }

  // Extract and normalize semantic core meaning
  private normalizeForSemanticMatch(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      // Normalize common variations
      .replace(/\bi('m|m)\b/g, 'i am')
      .replace(/\byou('re|re)\b/g, 'you are')
      .replace(/\bdon('t|t)\b/g, 'do not')
      .replace(/\bcan('t|t)\b/g, 'cannot')
      .replace(/\bwon('t|t)\b/g, 'will not')
      .replace(/\bisn('t|t)\b/g, 'is not')
      .replace(/\baren('t|t)\b/g, 'are not')
      .replace(/\bwasn('t|t)\b/g, 'was not')
      .replace(/\bweren('t|t)\b/g, 'were not')
      .replace(/\bhaven('t|t)\b/g, 'have not')
      .replace(/\bhasn('t|t)\b/g, 'has not')
      .replace(/\bhadn('t|t)\b/g, 'had not');
  }

  // Extract semantic core concepts and patterns
  private calculateSemanticCoreMatch(text1: string, text2: string): number {
    // Define semantic concept groups that should match highly
    const semanticConcepts = {
      inadequacy: ['not good enough', 'not enough', 'never enough', 'not sufficient', 'inadequate', 'insufficient', 'not right', 'not capable', 'not able', 'cannot do', 'not capable enough', 'not measuring up'],
      failure: ['falling short', 'coming up short', 'not measuring up', 'disappointing', 'letting down', 'failing', 'not making it', 'not succeeding', 'coming up short', 'failing to meet'],
      effort: ['no matter what i do', 'nothing i do', 'whatever i do', 'however hard i try', 'how much effort', 'how hard i work', 'regardless of my efforts', 'no matter how hard', 'regardless of efforts'],
      feeling: ['i feel like', 'i feel that', 'it feels like', 'i think', 'i believe', 'seems like', 'appears that', 'i cannot shake the feeling', 'i cannot escape the feeling', 'it seems like'],
      always_never: ['always', 'never', 'constantly', 'perpetually', 'forever', 'all the time', 'every time', 'no matter what', 'regardless of'],
      emotional_states: ['sad', 'happy', 'angry', 'confused', 'anxious', 'worried', 'scared', 'grateful', 'thankful'],
      spiritual_emptiness: ['spiritually empty', 'spiritual emptiness', 'spiritually numb', 'spiritually vacant', 'spiritually dead', 'spiritual void', 'empty spiritually', 'hollow inside', 'completely hollow', 'feel nothing', 'feel empty', 'feeling nothing', 'feeling empty', 'spiritual dryness', 'spiritually dry'],
      religious_practice: ['still pray', 'keep praying', 'pray every day', 'pray regularly', 'religious practices', 'religious routine', 'go through motions', 'go through rituals', 'maintain routine', 'do all practices'],
      spiritual_disconnection: ['no connection', 'disconnected from faith', 'disconnected from god', 'no spiritual connection', 'prayers bounce off', 'prayers feel empty', 'prayers meaningless', 'no spiritual fulfillment', 'spiritual life feels dead', 'feel no connection']
    };

    let matchScore = 0;
    let conceptsFound = 0;

    for (const [concept, phrases] of Object.entries(semanticConcepts)) {
      const inText1 = phrases.some(phrase => text1.includes(phrase));
      const inText2 = phrases.some(phrase => text2.includes(phrase));

      if (inText1 && inText2) {
        matchScore += 1;
        conceptsFound++;
        this.logger.debug(`Semantic concept match found: ${concept}`);
      } else if (inText1 || inText2) {
        // Partial bonus for related concepts
        const relatedMatch = this.findRelatedConcepts(concept, text1, text2, semanticConcepts);
        if (relatedMatch > 0) {
          matchScore += relatedMatch * 0.7;
          conceptsFound += 0.7;
        }
      }
    }

    return conceptsFound > 0 ? Math.min(matchScore / Math.max(conceptsFound, 1), 1.0) : 0;
  }

  // Find related semantic concepts
  private findRelatedConcepts(concept: string, text1: string, text2: string, concepts: any): number {
    const relatedConcepts: { [key: string]: string[] } = {
      inadequacy: ['failure', 'effort'],
      failure: ['inadequacy', 'effort'],
      effort: ['inadequacy', 'failure'],
      feeling: ['emotional_states', 'spiritual_emptiness'],
      emotional_states: ['feeling', 'spiritual_emptiness', 'spiritual_disconnection'],
      spiritual_emptiness: ['spiritual_disconnection', 'religious_practice', 'feeling', 'emotional_states'],
      religious_practice: ['spiritual_emptiness', 'spiritual_disconnection'],
      spiritual_disconnection: ['spiritual_emptiness', 'religious_practice', 'emotional_states']
    };

    if (!relatedConcepts[concept]) return 0;

    let relatedScore = 0;
    for (const relatedConcept of relatedConcepts[concept]) {
      if (concepts[relatedConcept]) {
        const phrases = concepts[relatedConcept];
        const inText1 = phrases.some((phrase: string) => text1.includes(phrase));
        const inText2 = phrases.some((phrase: string) => text2.includes(phrase));
        if (inText1 && inText2) {
          relatedScore += 0.5;
        }
      }
    }

    return relatedScore;
  }

  // Advanced phrase similarity focusing on meaning rather than exact words
  private calculateAdvancedPhraseSimilarity(text1: string, text2: string): number {
    // Enhanced emotional and meaning-based phrase groups
    const meaningGroups = {
      'inadequacy_self': ['not good enough', 'not enough', 'never enough', 'not sufficient', 'inadequate', 'insufficient', 'not capable', 'not able', 'not worthy', 'not deserving'],
      'failure_attempts': ['falling short', 'coming up short', 'not measuring up', 'not making the cut', 'not meeting expectations', 'disappointing others', 'letting people down'],
      'persistent_effort': ['no matter what i do', 'nothing i do', 'whatever i do', 'however hard i try', 'regardless of my efforts', 'no matter how much effort'],
      'emotional_certainty': ['i feel like', 'it feels like', 'i always feel', 'i constantly feel', 'i can never shake the feeling', 'i cannot escape the feeling'],
      'universal_quantifiers': ['always', 'never', 'nothing', 'everything', 'all the time', 'constantly', 'perpetually', 'forever'],
      'impact_on_others': ['disappointing people', 'letting others down', 'not meeting expectations', 'falling short of what others expect'],
      'self_doubt': ['not capable enough', 'just not measuring up', 'not able to do anything right', 'never able to succeed', 'stuck in a cycle'],
      'spiritual_emptiness_core': ['spiritually empty', 'spiritual emptiness', 'spiritually numb', 'spiritually vacant', 'spiritually dead', 'hollow inside', 'completely hollow', 'feel nothing', 'feeling nothing'],
      'religious_practice_maintenance': ['still pray', 'keep praying', 'pray every day', 'pray regularly', 'religious practices', 'religious routine', 'go through motions', 'maintain routine'],
      'spiritual_disconnection_phrases': ['no connection', 'disconnected from faith', 'no spiritual connection', 'prayers feel empty', 'prayers meaningless', 'no spiritual fulfillment', 'spiritual life feels dead']
    };

    let totalMatches = 0;
    let groupsChecked = 0;

    for (const [group, phrases] of Object.entries(meaningGroups)) {
      groupsChecked++;
      let groupScore = 0;

      // Check for any phrase in this group appearing in both texts
      let text1HasGroup = false;
      let text2HasGroup = false;

      for (const phrase of phrases) {
        if (text1.includes(phrase)) text1HasGroup = true;
        if (text2.includes(phrase)) text2HasGroup = true;
      }

      if (text1HasGroup && text2HasGroup) {
        groupScore = 1.0;
        this.logger.debug(`Advanced phrase match in group '${group}'`);
      } else if (text1HasGroup || text2HasGroup) {
        // Check for related phrases that convey similar meaning
        groupScore = this.calculateCrossGroupSimilarity(group, text1, text2, meaningGroups);
      }

      totalMatches += groupScore;
    }

    return groupsChecked > 0 ? totalMatches / groupsChecked : 0;
  }

  // Calculate similarity between different meaning groups
  private calculateCrossGroupSimilarity(currentGroup: string, text1: string, text2: string, meaningGroups: any): number {
    const relatedGroups: { [key: string]: { group: string, weight: number }[] } = {
      'inadequacy_self': [
        { group: 'failure_attempts', weight: 0.8 },
        { group: 'self_doubt', weight: 0.9 }
      ],
      'failure_attempts': [
        { group: 'inadequacy_self', weight: 0.8 },
        { group: 'persistent_effort', weight: 0.7 }
      ],
      'persistent_effort': [
        { group: 'failure_attempts', weight: 0.7 },
        { group: 'emotional_certainty', weight: 0.6 }
      ],
      'emotional_certainty': [
        { group: 'universal_quantifiers', weight: 0.6 },
        { group: 'self_doubt', weight: 0.7 },
        { group: 'spiritual_emptiness_core', weight: 0.8 }
      ],
      'universal_quantifiers': [
        { group: 'emotional_certainty', weight: 0.6 }
      ],
      'impact_on_others': [
        { group: 'inadequacy_self', weight: 0.6 },
        { group: 'failure_attempts', weight: 0.7 }
      ],
      'self_doubt': [
        { group: 'inadequacy_self', weight: 0.9 },
        { group: 'emotional_certainty', weight: 0.7 }
      ],
      'spiritual_emptiness_core': [
        { group: 'spiritual_disconnection_phrases', weight: 0.9 },
        { group: 'religious_practice_maintenance', weight: 0.8 },
        { group: 'emotional_certainty', weight: 0.7 }
      ],
      'religious_practice_maintenance': [
        { group: 'spiritual_emptiness_core', weight: 0.8 },
        { group: 'spiritual_disconnection_phrases', weight: 0.7 }
      ],
      'spiritual_disconnection_phrases': [
        { group: 'spiritual_emptiness_core', weight: 0.9 },
        { group: 'religious_practice_maintenance', weight: 0.7 }
      ]
    };

    if (!relatedGroups[currentGroup]) return 0;

    let bestScore = 0;

    for (const { group: relatedGroup, weight } of relatedGroups[currentGroup]) {
      if (meaningGroups[relatedGroup]) {
        const phrases = meaningGroups[relatedGroup];
        const text1HasRelated = phrases.some((phrase: string) => text1.includes(phrase));
        const text2HasRelated = phrases.some((phrase: string) => text2.includes(phrase));

        if (text1HasRelated && text2HasRelated) {
          bestScore = Math.max(bestScore, weight);
        }
      }
    }

    return bestScore;
  }

  // Calculate contextual word matching with synonyms and related terms
  private calculateContextualWordMatch(text1: string, text2: string): number {
    const synonymGroups = {
      'inadequate': ['insufficient', 'lacking', 'deficient', 'poor', 'weak', 'subpar'],
      'good': ['great', 'excellent', 'fine', 'okay', 'sufficient', 'adequate', 'right'],
      'enough': ['sufficient', 'adequate', 'satisfactory', 'acceptable'],
      'try': ['attempt', 'work', 'effort', 'struggle', 'strive'],
      'feel': ['think', 'believe', 'sense', 'perceive', 'experience'],
      'never': ['not', 'cannot', 'unable', 'impossible'],
      'always': ['constantly', 'continually', 'forever', 'perpetually']
    };

    const words1 = text1.split(' ').filter(w => w.length > 2);
    const words2 = text2.split(' ').filter(w => w.length > 2);

    let matches = 0;
    let totalComparisons = 0;

    for (const word1 of words1) {
      for (const word2 of words2) {
        totalComparisons++;

        // Direct match
        if (word1 === word2) {
          matches += 1;
          continue;
        }

        // Synonym match
        let synonymMatch = false;
        for (const [key, synonyms] of Object.entries(synonymGroups)) {
          const word1InGroup = word1 === key || synonyms.includes(word1);
          const word2InGroup = word2 === key || synonyms.includes(word2);

          if (word1InGroup && word2InGroup) {
            matches += 0.8;
            synonymMatch = true;
            break;
          }
        }

        if (synonymMatch) continue;

        // Partial string match
        if (word1.includes(word2) || word2.includes(word1)) {
          matches += 0.5;
        }
      }
    }

    return totalComparisons > 0 ? matches / totalComparisons : 0;
  }

  // Calculate structural similarity (sentence patterns, question structure)
  private calculateStructureSimilarity(text1: string, text2: string): number {
    const getStructureFeatures = (text: string) => {
      return {
        startsWithI: text.startsWith('i '),
        hasQuestion: text.includes('?'),
        hasNegation: /\b(not|no|never|cannot|can't|don't|doesn't|won't|wouldn't)\b/.test(text),
        hasEmotion: /\b(feel|feeling|think|believe|seem)\b/.test(text),
        hasQuantifier: /\b(always|never|all|every|nothing|something|anything)\b/.test(text),
        wordCount: text.split(' ').length,
        hasComparison: /\b(than|as|like|compare|better|worse)\b/.test(text)
      };
    };

    const features1 = getStructureFeatures(text1);
    const features2 = getStructureFeatures(text2);

    let similarFeatures = 0;
    let totalFeatures = 0;

    // Compare boolean features
    const booleanFeatures = ['startsWithI', 'hasQuestion', 'hasNegation', 'hasEmotion', 'hasQuantifier', 'hasComparison'];
    for (const feature of booleanFeatures) {
      totalFeatures++;
      if (features1[feature as keyof typeof features1] === features2[feature as keyof typeof features2]) {
        similarFeatures++;
      }
    }

    // Compare word count similarity
    totalFeatures++;
    const wordCountSim = 1 - Math.abs(features1.wordCount - features2.wordCount) / Math.max(features1.wordCount, features2.wordCount);
    similarFeatures += wordCountSim;

    return totalFeatures > 0 ? similarFeatures / totalFeatures : 0;
  }

  // Levenshtein distance-based similarity
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(str1, str2);
    return (maxLen - distance) / maxLen;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Enhanced phrase similarity for emotional expressions
  private calculatePhraseSimilarity(str1: string, str2: string): number {
    // Key emotional phrases that should match highly
    const emotionalPhrases = [
      'not good enough', 'not enough', 'never enough', 'not sufficient',
      'falling short', 'coming up short', 'not measuring up',
      'not capable', 'not able', 'cannot do', 'cant do',
      'disappointing', 'letting down', 'failing',
      'inadequate', 'insufficient', 'not right'
    ];

    let matchScore = 0;

    for (const phrase of emotionalPhrases) {
      const inStr1 = str1.includes(phrase);
      const inStr2 = str2.includes(phrase);

      if (inStr1 && inStr2) {
        matchScore += 1;
      } else if (inStr1 || inStr2) {
        // Check for similar phrases
        const synonyms = this.getPhraseSynonyms(phrase);
        for (const synonym of synonyms) {
          if ((inStr1 && str2.includes(synonym)) || (inStr2 && str1.includes(synonym))) {
            matchScore += 0.8;
            break;
          }
        }
      }
    }

    // If we found significant phrase matches, boost the score
    if (matchScore > 0) {
      const phraseBonus = Math.min(matchScore / 3, 1.0); // Cap at 1.0
      return phraseBonus;
    }

    return 0;
  }

  private getPhraseSynonyms(phrase: string): string[] {
    const synonymMap: { [key: string]: string[] } = {
      'not good enough': ['not sufficient', 'inadequate', 'not measuring up'],
      'falling short': ['coming up short', 'not enough', 'insufficient'],
      'not capable': ['not able', 'cannot do', 'cant do'],
      'disappointing': ['letting down', 'failing']
    };

    return synonymMap[phrase] || [];
  }
}
