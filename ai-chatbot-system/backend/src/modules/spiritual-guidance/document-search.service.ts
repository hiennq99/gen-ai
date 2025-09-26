import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';

export interface DocumentChunk {
  id: string;
  content: string;
  source: string;
  page?: number;
  uploadedAt: Date;
  embedding?: number[];
  metadata?: {
    fileType: string;
    category: 'handbook' | 'qa' | 'general';
    chapter?: string;
    keywords?: string[];
  };
}

export interface DocumentMatch {
  chunk: DocumentChunk;
  similarity: number;
  relevanceScore: number;
}

export interface HybridSearchResult {
  documentMatches: DocumentMatch[];
  totalMatches: number;
  searchQuery: string;
  processingTime: number;
}

@Injectable()
export class DocumentSearchService {
  private readonly logger = new Logger(DocumentSearchService.name);

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Search uploaded training documents using semantic similarity
   */
  async searchDocuments(
    query: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      categories?: ('handbook' | 'qa' | 'general')[];
      includeMetadata?: boolean;
    } = {}
  ): Promise<HybridSearchResult> {
    const startTime = Date.now();
    const {
      limit = 5,
      minSimilarity = 0.3,
      categories = ['handbook', 'qa', 'general'],
    } = options;

    try {
      this.logger.log(`Searching documents for query: "${query.slice(0, 50)}..."`);

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Search for similar document chunks
      const matches = await this.performVectorSearch(
        queryEmbedding,
        {
          limit,
          minSimilarity,
          categories
        }
      );

      // Enhance matches with AI-powered relevance scoring
      const enhancedMatches = await this.enhanceMatchesWithAI(query, matches);

      // Sort by relevance score (combination of similarity + AI relevance)
      const sortedMatches = enhancedMatches
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      const processingTime = Date.now() - startTime;

      this.logger.log(`Document search completed`, {
        query: query.slice(0, 30),
        totalMatches: matches.length,
        finalMatches: sortedMatches.length,
        processingTime
      });

      return {
        documentMatches: sortedMatches,
        totalMatches: matches.length,
        searchQuery: query,
        processingTime
      };

    } catch (error) {
      this.logger.error('Document search failed', error);
      return {
        documentMatches: [],
        totalMatches: 0,
        searchQuery: query,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate embedding for text using Bedrock
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use the existing generateEmbedding method from BedrockService
      return await this.bedrockService.generateEmbedding(text);
    } catch (error) {
      this.logger.error('Failed to generate embedding', error);

      // Fallback: Use simple text-based similarity
      return this.generateSimpleEmbedding(text);
    }
  }

  /**
   * Simple embedding fallback for development/testing
   */
  private generateSimpleEmbedding(text: string): number[] {
    // Simple word frequency-based embedding (for fallback only)
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq: Record<string, number> = {};

    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Convert to fixed-size embedding (384 dimensions)
    const embedding = new Array(384).fill(0);
    const wordList = Object.keys(wordFreq);

    wordList.slice(0, 384).forEach((word, index) => {
      embedding[index] = wordFreq[word] / words.length;
    });

    return embedding;
  }

  /**
   * Perform vector search in database
   */
  private async performVectorSearch(
    queryEmbedding: number[],
    options: {
      limit: number;
      minSimilarity: number;
      categories: string[];
    }
  ): Promise<DocumentMatch[]> {
    try {
      // Query document chunks from database
      // This would typically use a vector database like Pinecone, Weaviate, or PostgreSQL with pgvector
      const chunks = await this.getDocumentChunks(options.categories);

      // Calculate cosine similarity for each chunk
      const matches: DocumentMatch[] = [];

      for (const chunk of chunks) {
        if (!chunk.embedding || chunk.embedding.length === 0) {
          // Generate embedding for chunks that don't have one
          chunk.embedding = await this.generateEmbedding(chunk.content);
          // TODO: Save embedding back to database
        }

        const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);

        if (similarity >= options.minSimilarity) {
          matches.push({
            chunk,
            similarity,
            relevanceScore: similarity // Will be enhanced by AI
          });
        }
      }

      return matches.sort((a, b) => b.similarity - a.similarity).slice(0, options.limit * 2);
    } catch (error) {
      this.logger.error('Vector search failed', error);
      return [];
    }
  }

  /**
   * Enhance matches with AI-powered relevance scoring
   */
  private async enhanceMatchesWithAI(query: string, matches: DocumentMatch[]): Promise<DocumentMatch[]> {
    try {
      const enhancedMatches: DocumentMatch[] = [];

      for (const match of matches) {
        // Use Claude to score relevance of each match
        const relevancePrompt = `
Rate the relevance of this text passage to the user's query on a scale of 0.0 to 1.0.

User Query: "${query}"

Text Passage: "${match.chunk.content.slice(0, 500)}..."

Consider:
1. Direct relevance to the user's spiritual/emotional state
2. Practical applicability to their situation
3. Quality and depth of guidance offered

Respond with just a number between 0.0 and 1.0:`;

        const relevanceResponse = await this.bedrockService.invokeModel({
          messages: [{ role: 'user', content: relevancePrompt }],
          maxTokens: 10,
          temperature: 0.1
        });

        const aiRelevanceScore = parseFloat(relevanceResponse.content?.trim() || '0') || 0;

        // Combine similarity and AI relevance (weighted average)
        const combinedScore = (match.similarity * 0.4) + (aiRelevanceScore * 0.6);

        enhancedMatches.push({
          ...match,
          relevanceScore: combinedScore
        });
      }

      return enhancedMatches;
    } catch (error) {
      this.logger.warn('AI enhancement failed, using similarity scores', error);
      return matches;
    }
  }

  /**
   * Get document chunks from database
   */
  private async getDocumentChunks(categories: string[]): Promise<DocumentChunk[]> {
    try {
      // Query from your document storage
      // This could be DynamoDB, PostgreSQL, or another database
      const result = await this.databaseService.queryItems('SpiritualGuidanceDocuments', {
        categories: categories.join(',')
      });

      return (result || []).map((item: any) => ({
        id: item.id,
        content: item.content,
        source: item.source,
        page: item.page,
        uploadedAt: new Date(item.uploadedAt),
        embedding: item.embedding ? JSON.parse(item.embedding) : undefined,
        metadata: item.metadata
      }));

    } catch (error) {
      this.logger.error('Failed to fetch document chunks', error);

      // Return sample data for testing
      return this.getSampleDocumentChunks();
    }
  }

  /**
   * Sample document chunks for testing
   */
  private getSampleDocumentChunks(): DocumentChunk[] {
    return [
      {
        id: 'sample-1',
        content: 'The importance of patience in times of difficulty cannot be overstated. When facing hardships, remember that Allah tests those He loves, and through patience, we develop spiritual strength and resilience.',
        source: 'Spiritual Wisdom Handbook',
        page: 45,
        uploadedAt: new Date(),
        metadata: {
          fileType: 'pdf',
          category: 'handbook',
          chapter: 'Patience and Perseverance',
          keywords: ['patience', 'hardship', 'resilience', 'faith']
        }
      },
      {
        id: 'sample-2',
        content: 'Anger is a natural human emotion, but it must be controlled through remembrance of Allah and seeking refuge in Him. The Prophet (peace be upon him) advised us to seek refuge in Allah when anger arises.',
        source: 'Islamic Psychology Guide',
        page: 23,
        uploadedAt: new Date(),
        metadata: {
          fileType: 'pdf',
          category: 'handbook',
          chapter: 'Managing Emotions',
          keywords: ['anger', 'emotion', 'control', 'prophet']
        }
      }
    ];
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      this.logger.warn('Vector dimension mismatch');
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Store processed document chunks
   */
  async storeDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
    try {
      for (const chunk of chunks) {
        // Generate embedding if not present
        if (!chunk.embedding) {
          chunk.embedding = await this.generateEmbedding(chunk.content);
        }

        // Store in database
        const item = {
          id: chunk.id,
          content: chunk.content,
          source: chunk.source,
          page: chunk.page,
          uploadedAt: chunk.uploadedAt.toISOString(),
          embedding: JSON.stringify(chunk.embedding),
          metadata: chunk.metadata,
          createdAt: new Date().toISOString()
        };

        await this.databaseService.createItem('SpiritualGuidanceDocuments', item);
      }

      this.logger.log(`Stored ${chunks.length} document chunks`);
    } catch (error) {
      this.logger.error('Failed to store document chunks', error);
      throw error;
    }
  }

  /**
   * Process uploaded file and extract chunks
   */
  async processUploadedFile(
    filePath: string,
    metadata: {
      originalName: string;
      category: 'handbook' | 'qa' | 'general';
      fileType: string;
    }
  ): Promise<DocumentChunk[]> {
    try {
      // Extract text from file (PDF, DOCX, etc.)
      const extractedText = await this.extractTextFromFile(filePath, metadata.fileType);

      // Split into chunks
      const chunks = this.splitTextIntoChunks(extractedText, {
        maxChunkSize: 500,
        overlapSize: 50,
        source: metadata.originalName,
        category: metadata.category
      });

      // Store chunks in database
      await this.storeDocumentChunks(chunks);

      this.logger.log(`Processed file: ${metadata.originalName}, created ${chunks.length} chunks`);

      return chunks;
    } catch (error) {
      this.logger.error(`Failed to process file: ${metadata.originalName}`, error);
      throw error;
    }
  }

  /**
   * Extract text from various file formats
   */
  private async extractTextFromFile(filePath: string, fileType: string): Promise<string> {
    // This would use libraries like pdf-parse, mammoth, etc.
    // For now, return placeholder
    return `Sample extracted text from ${fileType} file. This would contain the actual document content in a real implementation.`;
  }

  /**
   * Split text into manageable chunks
   */
  private splitTextIntoChunks(
    text: string,
    options: {
      maxChunkSize: number;
      overlapSize: number;
      source: string;
      category: 'handbook' | 'qa' | 'general';
    }
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > options.maxChunkSize && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          id: `${options.source}-chunk-${chunkIndex}`,
          content: currentChunk.trim(),
          source: options.source,
          uploadedAt: new Date(),
          metadata: {
            fileType: 'extracted',
            category: options.category,
            keywords: this.extractKeywords(currentChunk)
          }
        });

        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-options.overlapSize);
        currentChunk = overlapWords.join(' ') + ' ';
        chunkIndex++;
      }

      currentChunk += sentence.trim() + '. ';
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${options.source}-chunk-${chunkIndex}`,
        content: currentChunk.trim(),
        source: options.source,
        uploadedAt: new Date(),
        metadata: {
          fileType: 'extracted',
          category: options.category,
          keywords: this.extractKeywords(currentChunk)
        }
      });
    }

    return chunks;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }
}