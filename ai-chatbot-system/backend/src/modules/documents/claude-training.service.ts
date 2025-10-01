import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { DatabaseService } from '../database/database.service';

export interface TrainingResult {
  success: boolean;
  documentId: string;
  fileName: string;
  contentLength: number;
  trainingSummary: string;
  trainedAt: string;
  error?: string;
}

@Injectable()
export class ClaudeTrainingService {
  private readonly logger = new Logger(ClaudeTrainingService.name);
  private readonly MAX_TRAINING_CONTENT = 100000; // 100k characters per training session

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Train Claude to read and memorize PDF content
   * This creates a "memory" of the document that Claude can recall later
   */
  async trainOnDocument(
    documentId: string,
    fileName: string,
    content: string,
    metadata?: any
  ): Promise<TrainingResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`🎓 Starting Claude training on document: ${fileName} (${content.length} chars)`);

      // Split content into manageable chunks if too large
      const trainingChunks = this.splitIntoTrainingChunks(content);

      this.logger.log(`📚 Split into ${trainingChunks.length} training chunks`);

      let trainingSummary = '';

      // Train Claude on each chunk
      for (const [index, chunk] of trainingChunks.entries()) {
        this.logger.log(`🔄 Training chunk ${index + 1}/${trainingChunks.length}...`);

        const chunkSummary = await this.trainOnChunk(fileName, chunk, index + 1, trainingChunks.length);
        trainingSummary += chunkSummary + '\n\n';
      }

      // Final consolidation - help Claude remember the entire document
      const consolidationSummary = await this.consolidateTraining(fileName, trainingSummary, metadata);

      // Save training record to database
      const trainingRecord = {
        id: `training-${documentId}-${Date.now()}`,
        documentId,
        fileName,
        contentLength: content.length,
        chunksProcessed: trainingChunks.length,
        trainingSummary: consolidationSummary,
        trainedAt: new Date().toISOString(),
        trainedAtTimestamp: Date.now(),
        metadata: {
          ...metadata,
          trainingDuration: Date.now() - startTime,
          status: 'completed',
        },
      };

      await this.saveTrainingRecord(trainingRecord);

      this.logger.log(`✅ Claude training completed for ${fileName} in ${Date.now() - startTime}ms`);

      return {
        success: true,
        documentId,
        fileName,
        contentLength: content.length,
        trainingSummary: consolidationSummary,
        trainedAt: trainingRecord.trainedAt,
      };

    } catch (error) {
      this.logger.error(`❌ Claude training failed for ${fileName}:`, error);

      return {
        success: false,
        documentId,
        fileName,
        contentLength: content.length,
        trainingSummary: '',
        trainedAt: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Train Claude on a single chunk of content
   */
  private async trainOnChunk(
    fileName: string,
    content: string,
    chunkIndex: number,
    totalChunks: number
  ): Promise<string> {
    const trainingPrompt = `You are being trained on a document to help users later. Read and memorize this content carefully.

📄 Document: "${fileName}"
📊 Part: ${chunkIndex} of ${totalChunks}

CONTENT TO MEMORIZE:
${content}

INSTRUCTIONS:
1. Read this content thoroughly and memorize the key information
2. Identify the main topics, concepts, and important details
3. Remember exact quotes, facts, and data points
4. Note any questions this content could answer
5. Provide a brief summary of what you learned (100-200 words)

Your summary:`;

    const response = await this.bedrockService.invokeModel({
      messages: [{ role: 'user', content: trainingPrompt }],
      maxTokens: 300,
      temperature: 0.3, // Lower temperature for more accurate learning
    });

    return response.content || 'Training chunk processed';
  }

  /**
   * Consolidate training across all chunks
   */
  private async consolidateTraining(
    fileName: string,
    allSummaries: string,
    metadata?: any
  ): Promise<string> {
    const consolidationPrompt = `You have just been trained on a document called "${fileName}". Here are summaries of what you learned from each section:

${allSummaries}

CONSOLIDATION TASK:
1. Combine these summaries into a comprehensive understanding
2. Identify the main themes and key takeaways
3. Remember this document's name and content for future questions
4. Note what types of questions this document can answer

Provide a consolidated summary (200-300 words) that captures the essence of this document:`;

    const response = await this.bedrockService.invokeModel({
      messages: [{ role: 'user', content: consolidationPrompt }],
      maxTokens: 400,
      temperature: 0.3,
    });

    return response.content || 'Training consolidated successfully';
  }

  /**
   * Split content into manageable training chunks
   */
  private splitIntoTrainingChunks(content: string): string[] {
    const chunks: string[] = [];

    // If content is small enough, return as single chunk
    if (content.length <= this.MAX_TRAINING_CONTENT) {
      return [content];
    }

    // Split by paragraphs/sections to maintain context
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed limit, save current chunk
      if (currentChunk.length + paragraph.length > this.MAX_TRAINING_CONTENT && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += '\n\n' + paragraph;
      }
    }

    // Add remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Save training record to database
   */
  private async saveTrainingRecord(record: any): Promise<void> {
    try {
      // Save as a document with type 'training_record'
      const trainingDocument = {
        ...record,
        type: 'training_record',
        title: `Training: ${record.fileName}`,
        content: record.trainingSummary,
        uploadedAt: record.trainedAtTimestamp,
        uploadedAtISO: record.trainedAt,
        status: 'processed' as const,
      };
      await this.databaseService.saveDocument(trainingDocument);
      this.logger.log(`💾 Training record saved: ${record.id}`);
    } catch (error) {
      this.logger.warn('Failed to save training record, continuing...', error);
      // Don't throw - training success is more important than record keeping
    }
  }

  /**
   * Get training history for a document
   */
  async getTrainingHistory(documentId: string): Promise<any[]> {
    try {
      // Query documents with type 'training_record' and matching documentId
      const allDocs = await this.databaseService.listDocuments();
      const trainingRecords = allDocs.filter((doc: any) =>
        doc.type === 'training_record' && doc.documentId === documentId
      );
      return trainingRecords;
    } catch (error) {
      this.logger.error('Failed to get training history:', error);
      return [];
    }
  }

  /**
   * Check if a document has been trained
   */
  async isDocumentTrained(documentId: string): Promise<boolean> {
    const history = await this.getTrainingHistory(documentId);
    return history.length > 0;
  }
}
