import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { SearchService } from '../search/search.service';

@ApiTags('test-redis-vectors')
@Controller('test/redis-vectors')
export class TestRedisVectorsController {
  private readonly logger = new Logger(TestRedisVectorsController.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly searchService: SearchService,
  ) {}

  @Post('store-test-data')
  @ApiOperation({ summary: 'Store test vector data in Redis' })
  async storeTestData() {
    try {
      const testDocuments = [
        {
          id: 'test-doc-1',
          text: 'How to find peace in difficult times? Finding peace during challenges requires turning to Allah through prayer.',
          metadata: {
            type: 'pdf_content',
            sourceFile: 'spiritual-guidance.pdf',
            chunkIndex: 1,
          },
        },
        {
          id: 'test-doc-2',
          text: 'What should I do when I feel overwhelmed? Take time for dhikr and remember that Allah does not burden a soul beyond what it can bear.',
          metadata: {
            type: 'pdf_content',
            sourceFile: 'spiritual-guidance.pdf',
            chunkIndex: 2,
          },
        },
        {
          id: 'test-doc-3',
          text: 'Dealing with sadness and depression through Islamic guidance and community support.',
          metadata: {
            type: 'pdf_content',
            sourceFile: 'mental-health.pdf',
            chunkIndex: 1,
          },
        },
      ];

      const results = [];

      for (const doc of testDocuments) {
        // Generate embedding for the text
        const embedding = await this.searchService.generateEmbedding(doc.text);

        // Store in Redis vector database
        await this.databaseService.storeVectorDocument({
          id: doc.id,
          text: doc.text,
          embedding,
          metadata: doc.metadata,
        });

        results.push({
          id: doc.id,
          stored: true,
          embeddingLength: embedding.length,
        });

        this.logger.log(`Stored test document: ${doc.id}`);
      }

      return {
        success: true,
        message: 'Test vector data stored successfully',
        results,
      };
    } catch (error) {
      this.logger.error('Error storing test data:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search test vector data' })
  async searchTestData(@Query('q') query: string = 'peace and calm') {
    try {
      // Test vector similarity search
      const queryEmbedding = await this.searchService.generateEmbedding(query);

      const vectorResults = await this.databaseService.searchVectorSimilar(
        queryEmbedding,
        5,
        0.1 // Very low threshold for testing
      );

      // Test PDF content search
      const pdfResults = await this.searchService.searchPDFContent(query, {
        limit: 5,
        threshold: 0.1,
      });

      return {
        success: true,
        query,
        results: {
          vectorSearch: {
            count: vectorResults.length,
            results: vectorResults.map(r => ({
              id: r.id,
              text: r.text.substring(0, 100) + '...',
              similarity: r.similarity,
              metadata: r.metadata,
            })),
          },
          pdfSearch: {
            count: pdfResults.length,
            results: pdfResults.map(r => ({
              id: r.id,
              text: r.text.substring(0, 100) + '...',
              similarity: r.similarity,
              highlight: r.highlight,
            })),
          },
        },
      };
    } catch (error) {
      this.logger.error('Error searching test data:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get Redis vector database stats' })
  async getStats() {
    try {
      const stats = await this.databaseService.getVectorStats();

      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error('Error getting stats:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('clear')
  @ApiOperation({ summary: 'Clear all test vector data' })
  async clearTestData() {
    try {
      await this.databaseService.clearVectorDatabase();

      return {
        success: true,
        message: 'Vector database cleared',
      };
    } catch (error) {
      this.logger.error('Error clearing data:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('test-document')
  @ApiOperation({ summary: 'Get a specific test document' })
  async getTestDocument(@Query('id') id: string = 'test-doc-1') {
    try {
      const document = await this.databaseService.getVectorDocument(id);

      if (!document) {
        return {
          success: false,
          message: 'Document not found',
        };
      }

      return {
        success: true,
        document: {
          id: document.id,
          text: document.text,
          embeddingLength: document.embedding?.length || 0,
          metadata: document.metadata,
        },
      };
    } catch (error) {
      this.logger.error('Error getting document:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}