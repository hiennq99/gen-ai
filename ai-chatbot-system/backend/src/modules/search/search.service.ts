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
    const { query, emotion, limit = 10, minScore = 0.5, exactMatchFirst = true } = params;

    this.logger.log(`Searching for: "${query}" with limit: ${limit}, exactMatchFirst: ${exactMatchFirst}`);

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
        const exactMatch = await this.findExactQAMatch(query, emotion);
        if (exactMatch) {
          this.logger.log(`Found Q&A match for: "${query}" with emotion: ${emotion}`);
          return [exactMatch];
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
      const qaData = await this.databaseService.getTrainingData();
      
      if (!qaData || qaData.length === 0) {
        return null;
      }
      
      // Normalize query for comparison
      const normalizedQuery = this.normalizeText(query);
      
      // First, try to find matches with the same emotion
      let bestMatch = null;
      let bestScore = 0;
      
      for (const qa of qaData) {
        const normalizedQuestion = this.normalizeText(qa.question || '');
        let score = 0;
        
        // Check for exact match
        if (normalizedQuestion === normalizedQuery) {
          score = 1.0;
        } else {
          // Check for high similarity match
          score = this.calculateSimilarity(normalizedQuery, normalizedQuestion);
        }
        
        // Apply emotion bonus if emotions match
        if (emotion && qa.emotion) {
          if (qa.emotion === emotion) {
            score *= 1.2; // 20% bonus for matching emotion
          } else if (this.areEmotionsRelated(qa.emotion, emotion)) {
            score *= 1.1; // 10% bonus for related emotions
          }
        }
        
        // Check if this is our best match so far
        const threshold = this.configService.get<number>('chat.exactMatch.threshold', 0.9);
        if (score >= threshold && score > bestScore) {
          bestScore = score;
          bestMatch = {
            documentId: qa.id,
            title: qa.question,
            content: qa.answer,
            text: qa.answer,
            score: Math.min(score, 1.0), // Cap at 1.0
            metadata: {
              type: score >= 0.9 ? 'qa_exact_match' : score >= 0.65 ? 'qa_high_match' : 'qa_match',
              emotion: qa.emotion || 'neutral',
              category: qa.category,
              matchedQuestion: qa.question,
              emotionMatch: qa.emotion === emotion,
            },
          };
        }
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

  // Calculate similarity between two strings
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    if (union.size === 0) return 0;
    
    // Jaccard similarity
    return intersection.size / union.size;
  }
}
