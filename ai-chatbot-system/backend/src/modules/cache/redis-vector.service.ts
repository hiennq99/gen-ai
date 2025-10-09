import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  text: string;
  metadata: Record<string, any>;
  score: number;
}

@Injectable()
export class RedisVectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisVectorService.name);
  private client: Redis;
  private readonly indexName = 'document_vectors';
  private readonly vectorDimension = 1024; // Bedrock Titan v1 embedding dimension

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    this.client = new Redis({
      host,
      port,
      password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (error: any) => {
      this.logger.error('Redis client error:', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });
  }

  async onModuleInit() {
    try {
      // IORedis connects automatically
      await this.client.ping();
      await this.createIndex();
      this.logger.log('Redis vector service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Redis vector service:', error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch (error) {
      this.logger.error('Error disconnecting Redis client:', error);
    }
  }

  private async createIndex() {
    try {
      // With IORedis, we'll use a simpler approach without FT module
      // Store document IDs in a set for listing
      const existingDocs = await this.client.scard('doc_ids');
      this.logger.log(`Redis vector storage initialized with ${existingDocs} existing documents`);
    } catch (error) {
      this.logger.error('Error initializing vector storage:', error);
      // Continue with basic operations
      this.logger.warn('Using basic Redis operations for vector storage');
    }
  }

  async storeVector(document: VectorDocument): Promise<void> {
    try {
      const key = `doc:${document.id}`;

      // Store document as JSON string with vector
      const docData = {
        id: document.id,
        text: document.text,
        embedding: document.embedding,
        metadata: {
          ...document.metadata,
          createdAt: new Date().toISOString(),
        },
      };

      await this.client.set(key, JSON.stringify(docData));

      // Add to document IDs set for listing
      await this.client.sadd('doc_ids', document.id);

      this.logger.debug(`Stored vector document: ${document.id}`);
    } catch (error) {
      this.logger.error(`Error storing vector document ${document.id}:`, error);
      throw error;
    }
  }

  async getVector(id: string): Promise<VectorDocument | null> {
    try {
      const key = `doc:${id}`;
      const document = await this.client.get(key);

      if (!document) {
        return null;
      }

      return JSON.parse(document) as VectorDocument;
    } catch (error) {
      this.logger.error(`Error getting vector document ${id}:`, error);
      return null;
    }
  }

  async searchSimilar(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<VectorSearchResult[]> {
    try {
      this.logger.log(`🔍 Vector search called: query_dims=${queryVector.length}, limit=${limit}, threshold=${threshold}`);
      // Use manual similarity search since we don't have Redis Search module
      const results = await this.fallbackTextSearch(queryVector, limit, threshold);
      this.logger.log(`🔍 Vector search completed: found ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error('Error performing vector search:', error);
      return [];
    }
  }

  private async fallbackTextSearch(queryVector: number[], limit: number, threshold: number = 0.7): Promise<VectorSearchResult[]> {
    try {
      // Get all document IDs from the set
      const docIds = await this.client.smembers('doc_ids');
      this.logger.log(`🔍 Searching through ${docIds.length} documents, checking first ${Math.min(docIds.length, limit * 2)}`);

      const results: VectorSearchResult[] = [];
      let checkedCount = 0;
      let validEmbeddingCount = 0;

      for (const docId of docIds.slice(0, limit * 2)) { // Get more than needed for filtering
        try {
          const key = `doc:${docId}`;
          const docString = await this.client.get(key);

          if (docString) {
            const doc = JSON.parse(docString) as VectorDocument;
            checkedCount++;

            if (doc.embedding && doc.embedding.length > 0) {
              validEmbeddingCount++;
              const similarity = this.cosineSimilarity(queryVector, doc.embedding);

              if (checkedCount <= 3) {
                this.logger.log(`🔍 Sample doc ${docId}: similarity=${similarity.toFixed(4)}, threshold=${threshold}`);
              }

              if (similarity >= threshold) {
                results.push({
                  id: doc.id,
                  text: doc.text,
                  metadata: doc.metadata,
                  score: similarity,
                });
              }
            }
          }
        } catch (docError) {
          this.logger.warn(`Error processing document ${docId}:`, docError);
        }
      }

      this.logger.log(`🔍 Search summary: checked ${checkedCount} docs, ${validEmbeddingCount} had embeddings, ${results.length} above threshold`);

      // Sort by similarity and limit
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    } catch (error) {
      this.logger.error('Error in fallback text search:', error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      this.logger.warn(`Vector dimension mismatch: query=${a.length}, document=${b.length}`);
      throw new Error(`Vectors must have the same length: query=${a.length}, document=${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async deleteVector(id: string): Promise<void> {
    try {
      const key = `doc:${id}`;
      await this.client.del(key);
      await this.client.srem('doc_ids', id);
      this.logger.debug(`Deleted vector document: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting vector document ${id}:`, error);
      throw error;
    }
  }

  async searchByMetadata(
    filters: Record<string, any>,
    limit: number = 10
  ): Promise<VectorSearchResult[]> {
    try {
      // Get all document IDs and filter manually
      const docIds = await this.client.smembers('doc_ids');
      const results: VectorSearchResult[] = [];

      for (const docId of docIds) {
        try {
          const key = `doc:${docId}`;
          const docString = await this.client.get(key);

          if (docString) {
            const doc = JSON.parse(docString) as VectorDocument;
            let matches = true;

            // Check filters
            if (filters.sourceFile && doc.metadata?.sourceFile !== filters.sourceFile) {
              matches = false;
            }

            if (filters.type && doc.metadata?.type !== filters.type) {
              matches = false;
            }

            if (filters.chunkIndex !== undefined && doc.metadata?.chunkIndex !== filters.chunkIndex) {
              matches = false;
            }

            if (filters.documentId && doc.metadata?.documentId !== filters.documentId) {
              matches = false;
            }

            if (matches) {
              results.push({
                id: doc.id,
                text: doc.text,
                metadata: doc.metadata,
                score: 1.0, // Perfect match for metadata search
              });

              if (results.length >= limit) {
                break;
              }
            }
          }
        } catch (docError) {
          this.logger.warn(`Error processing document ${docId}:`, docError);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Error searching by metadata:', error);
      return [];
    }
  }

  async clearAll(): Promise<void> {
    try {
      // Get all document IDs
      const docIds = await this.client.smembers('doc_ids');

      if (docIds.length > 0) {
        // Delete all document keys
        const keys = docIds.map(id => `doc:${id}`);
        await this.client.del(...keys);

        // Clear the document IDs set
        await this.client.del('doc_ids');

        this.logger.log(`Cleared ${docIds.length} vector documents`);
      }
    } catch (error) {
      this.logger.error('Error clearing vector documents:', error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalDocuments: number;
    indexInfo?: any;
  }> {
    try {
      const docIds = await this.client.smembers('doc_ids');

      return {
        totalDocuments: docIds.length,
        indexInfo: {
          storage: 'Redis with IORedis',
          vectorSearch: 'Manual cosine similarity',
          indexName: this.indexName,
        },
      };
    } catch (error) {
      this.logger.error('Error getting vector stats:', error);
      return {
        totalDocuments: 0,
      };
    }
  }
}