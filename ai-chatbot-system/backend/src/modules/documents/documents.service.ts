import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DocumentProcessor } from './document-processor.service';
import { QASplitterService } from './qa-splitter.service';
import { StorageService } from '../storage/storage.service';
import { SearchService } from '../search/search.service';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { Document, DocumentChunk, ProcessingResult } from './interfaces/document.interface';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly CHUNK_SIZE = 1000; // characters per chunk
  private readonly CHUNK_OVERLAP = 200; // overlap between chunks

  constructor(
    private readonly documentProcessor: DocumentProcessor,
    private readonly qaSplitter: QASplitterService,
    private readonly storageService: StorageService,
    private readonly searchService: SearchService,
    private readonly databaseService: DatabaseService,
  ) {}

  async uploadDocument(file: Express.Multer.File, metadata?: any): Promise<Document> {
    const documentId = uuidv4();
    
    try {
      this.logger.log(`Processing document: ${file.originalname}`);

      // Validate file
      this.validateFile(file);

      // Upload to S3
      const s3Url = await this.storageService.uploadDocument(documentId, file);

      // Extract content with metadata (including page information for PDFs)
      const {content, metadata: extractedMetadata} = await this.documentProcessor.extractContentWithMetadata(file);

      // Check if content is Q&A format
      const qaPairs = this.qaSplitter.detectAndSplitQA(content, file.originalname);
      
      if (qaPairs && qaPairs.length > 0) {
        // Process as Q&A document - split into individual entries
        this.logger.log(`Detected ${qaPairs.length} Q&A pairs in document ${file.originalname}`);
        return await this.processQADocument(file, qaPairs, metadata, s3Url);
      }

      // Create document record (don't save full content here to avoid size limits)
      const document: Document = {
        id: documentId,
        title: metadata?.title || file.originalname,
        type: this.getDocumentType(file.mimetype),
        size: file.size,
        s3Url,
        // Store a preview/summary instead of full content
        content: content.substring(0, 5000), // Store first 5000 chars as preview
        uploadedAt: Date.now(), // Use timestamp for DynamoDB
        uploadedAtISO: new Date().toISOString(), // Keep ISO for display
        status: 'processing',
        metadata: {
          ...metadata,
          ...extractedMetadata,
          originalName: file.originalname,
          mimeType: file.mimetype,
          hasFullContent: true,
          contentLength: content.length,
        },
      };

      // Save to database
      await this.databaseService.saveDocument(document);

      // Process content asynchronously with metadata
      this.processDocumentContent(documentId, content, extractedMetadata).catch(error => {
        this.logger.error(`Failed to process document ${documentId}:`, error);
      });

      return document;
    } catch (error) {
      this.logger.error('Error uploading document:', error);
      throw error;
    }
  }

  private async processQADocument(
    file: Express.Multer.File,
    qaPairs: any[],
    metadata: any,
    s3Url: string
  ): Promise<Document> {
    const parentDocumentId = uuidv4();
    const documents: Document[] = [];
    
    // Create parent document record
    const parentDocument: Document = {
      id: parentDocumentId,
      title: metadata?.title || file.originalname,
      type: 'qa-collection',
      size: file.size,
      s3Url,
      content: `Q&A Collection: ${qaPairs.length} pairs`,
      uploadedAt: Date.now(),
      uploadedAtISO: new Date().toISOString(),
      status: 'processing',
      metadata: {
        ...metadata,
        originalName: file.originalname,
        mimeType: file.mimetype,
        isQACollection: true,
        totalQAPairs: qaPairs.length,
      },
    };
    
    await this.databaseService.saveDocument(parentDocument);
    
    // Process each Q&A pair as individual document
    for (const [index, qa] of qaPairs.entries()) {
      try {
        const qaDocumentId = uuidv4();
        const qaContent = this.qaSplitter.formatQAPair(qa);
        
        // Create individual Q&A document
        const qaDocument: Document = {
          id: qaDocumentId,
          title: qa.question.substring(0, 100),
          type: 'qa',
          size: qaContent.length,
          uploadedAt: Date.now(),
          uploadedAtISO: new Date().toISOString(),
          status: 'processed',
          content: qaContent, // Store full Q&A content since it's small
          metadata: {
            ...qa.metadata,
            parentDocumentId,
            qaIndex: index + 1,
            question: qa.question,
            answer: qa.answer,
            emotion: qa.metadata?.emotion,
            category: qa.metadata?.category,
            source: file.originalname,
          },
        };
        
        // Save to database
        await this.databaseService.saveDocument(qaDocument);
        
        // Generate embedding for better search
        const embedding = await this.searchService.generateEmbedding(qaContent);
        
        // Index in OpenSearch for search
        await this.searchService.indexDocument({
          id: qaDocumentId,
          documentId: qaDocumentId,
          title: qa.question,
          content: qaContent,
          text: qaContent,
          embedding,
          metadata: {
            type: 'qa',
            question: qa.question,
            answer: qa.answer,
            emotion: qa.metadata?.emotion,
            parentDocumentId,
            qaIndex: index + 1,
          },
        });
        
        documents.push(qaDocument);
        this.logger.debug(`Processed Q&A ${index + 1}/${qaPairs.length}: ${qa.question.substring(0, 50)}...`);
      } catch (error) {
        this.logger.error(`Failed to process Q&A pair ${index + 1}:`, error);
      }
    }
    
    // Update parent document status
    await this.databaseService.updateDocumentStatus(parentDocumentId, 'processed', {
      processedQAPairs: documents.length,
      failedQAPairs: qaPairs.length - documents.length,
      processedAt: Date.now(),
      processedAtISO: new Date().toISOString(),
    });
    
    this.logger.log(`Successfully processed ${documents.length}/${qaPairs.length} Q&A pairs from ${file.originalname}`);
    
    return parentDocument;
  }

  async processDocumentContent(documentId: string, content: string, documentMetadata?: any): Promise<ProcessingResult> {
    try {
      // Generate chunks with page information
      const chunks = this.createChunks(content, documentMetadata);
      
      // Generate embeddings for each chunk
      const processedChunks: DocumentChunk[] = [];
      
      for (const [index, chunk] of chunks.entries()) {
        const embedding = await this.searchService.generateEmbedding(chunk.text);
        
        const documentChunk: DocumentChunk = {
          id: `${documentId}-${index}`,
          documentId,
          chunkIndex: index,
          text: chunk.text,
          embedding,
          metadata: chunk.metadata,
        };
        
        processedChunks.push(documentChunk);
        
        // Index in OpenSearch (don't fail if indexing fails)
        try {
          await this.searchService.indexDocument({
            id: documentChunk.id,
            documentId,
            content: chunk.text,
            embedding,
            metadata: {
              chunkIndex: index,
              ...chunk.metadata,
            },
          });
        } catch (indexError) {
          this.logger.warn(`Failed to index chunk ${index} for document ${documentId}, continuing...`);
        }
      }

      // Store chunks in database for retrieval
      await this.storeDocumentChunks(documentId, processedChunks);

      // Update document status without full content
      await this.databaseService.updateDocumentStatus(documentId, 'processed', {
        totalChunks: chunks.length,
        processedAt: Date.now(),
        processedAtISO: new Date().toISOString(),
        contentPreview: content.substring(0, 1000), // Store preview only
      });

      return {
        documentId,
        chunksCreated: chunks.length,
        status: 'processed',
      };
    } catch (error) {
      await this.databaseService.updateDocumentStatus(documentId, 'failed', {
        error: error.message,
      });
      throw error;
    }
  }

  private createChunks(content: string, documentMetadata?: any): Array<{ text: string; metadata: any }> {
    const chunks: Array<{ text: string; metadata: any }> = [];
    const sentences = this.splitIntoSentences(content);

    let currentChunk = '';
    let chunkSentences: string[] = [];
    let currentCharPos = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.CHUNK_SIZE && currentChunk.length > 0) {
        const chunkStartPos = currentCharPos - currentChunk.length;
        const pageInfo = this.findPageForPosition(chunkStartPos, documentMetadata?.pages);

        chunks.push({
          text: currentChunk.trim(),
          metadata: {
            sentenceCount: chunkSentences.length,
            startChar: chunkStartPos,
            endChar: currentCharPos,
            page: pageInfo?.page,
            pageContent: pageInfo?.content?.substring(0, 200) + '...',
            documentName: documentMetadata?.filename,
            documentType: documentMetadata?.documentType,
            totalPages: documentMetadata?.totalPages,
          },
        });

        // Keep overlap
        const overlapSentences = chunkSentences.slice(-2);
        currentChunk = overlapSentences.join(' ') + ' ';
        chunkSentences = [...overlapSentences];
      }

      currentChunk += sentence + ' ';
      chunkSentences.push(sentence);
      currentCharPos += sentence.length + 1;
    }

    // Add remaining content
    if (currentChunk.trim().length > 0) {
      const chunkStartPos = currentCharPos - currentChunk.length;
      const pageInfo = this.findPageForPosition(chunkStartPos, documentMetadata?.pages);

      chunks.push({
        text: currentChunk.trim(),
        metadata: {
          sentenceCount: chunkSentences.length,
          startChar: chunkStartPos,
          endChar: currentCharPos,
          page: pageInfo?.page,
          pageContent: pageInfo?.content?.substring(0, 200) + '...',
          documentName: documentMetadata?.filename,
          documentType: documentMetadata?.documentType,
          totalPages: documentMetadata?.totalPages,
        },
      });
    }

    return chunks;
  }

  private findPageForPosition(charPosition: number, pages?: Array<{page: number, startIndex: number, content: string}>): {page: number, content: string} | null {
    if (!pages || pages.length === 0) {
      return null;
    }

    // Find the page that contains this character position
    for (let i = 0; i < pages.length; i++) {
      const currentPage = pages[i];
      const nextPage = pages[i + 1];

      if (charPosition >= currentPage.startIndex &&
          (!nextPage || charPosition < nextPage.startIndex)) {
        return {
          page: currentPage.page,
          content: currentPage.content
        };
      }
    }

    // Fallback to last page if position is beyond all pages
    return {
      page: pages[pages.length - 1].page,
      content: pages[pages.length - 1].content
    };
  }

  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting (can be improved with NLP libraries)
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  }

  private async storeDocumentChunks(documentId: string, chunks: DocumentChunk[]) {
    // Store chunks in database (in-memory or DynamoDB)
    try {
      for (const chunk of chunks) {
        await this.databaseService.saveDocumentChunk(documentId, chunk);
      }
      this.logger.log(`Stored ${chunks.length} chunks for document ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to store chunks for document ${documentId}:`, error);
    }
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    try {
      return await this.databaseService.getDocumentChunks(documentId);
    } catch (error) {
      this.logger.error(`Failed to get chunks for document ${documentId}:`, error);
      return [];
    }
  }

  async importQA(qaData: Array<{ question: string; answer: string; metadata?: any }>): Promise<any> {
    const results: {
      total: number;
      successful: number;
      failed: number;
      documents: Document[];
    } = {
      total: qaData.length,
      successful: 0,
      failed: 0,
      documents: [],
    };

    for (const qa of qaData) {
      try {
        const documentId = uuidv4();
        
        // Create combined content
        const content = `Question: ${qa.question}\n\nAnswer: ${qa.answer}`;
        
        // Create document
        const document: Document = {
          id: documentId,
          title: qa.question.substring(0, 100),
          type: 'qa',
          size: content.length,
          uploadedAt: Date.now(),
          uploadedAtISO: new Date().toISOString(),
          status: 'processed',
          metadata: {
            ...qa.metadata,
            question: qa.question,
            answer: qa.answer,
            type: 'imported-qa',
          },
        };

        // Save to database
        await this.databaseService.saveDocument(document);

        // Generate embedding
        const embedding = await this.searchService.generateEmbedding(content);

        // Index in OpenSearch
        await this.searchService.indexDocument({
          id: documentId,
          documentId,
          content,
          embedding,
          metadata: {
            type: 'qa',
            question: qa.question,
            ...qa.metadata,
          },
        });

        results.successful++;
        results.documents.push(document);
      } catch (error) {
        this.logger.error(`Failed to import Q&A: ${qa.question}`, error);
        results.failed++;
      }
    }

    return results;
  }

  async searchDocuments(query: string, options?: any): Promise<any[]> {
    return await this.searchService.searchDocuments({
      query,
      ...options,
    });
  }

  async getDocument(documentId: string): Promise<Document> {
    return await this.databaseService.getDocument(documentId) as Document;
  }

  async listDocuments(options?: any): Promise<Document[]> {
    return await this.databaseService.listDocuments(options) as Document[];
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Delete from S3
      await this.storageService.deleteDocument(documentId);
    } catch (error) {
      this.logger.warn(`Failed to delete document from S3: ${error.message}`);
    }
    
    try {
      // Delete from OpenSearch (won't throw if OpenSearch is not available)
      const result = await this.searchService.deleteDocument(documentId);
      if (!result.deleted) {
        this.logger.debug(`Document not deleted from search: ${result.reason || result.error}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete document from search: ${error.message}`);
    }
    
    // Delete from database (this should always work)
    await this.databaseService.deleteDocument(documentId);
  }

  private validateFile(file: Express.Multer.File): void {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/json',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not supported`);
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }
  }

  private getDocumentType(mimeType: string): string {
    const typeMap = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'application/json': 'json',
    };
    return typeMap[mimeType as keyof typeof typeMap] || 'unknown';
  }

  async deleteAllDocuments(): Promise<{ deletedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let deletedCount = 0;

    try {
      // Get all documents
      const documents = await this.listDocuments();
      this.logger.log(`Found ${documents.length} documents to delete`);

      // Delete each document
      for (const doc of documents) {
        try {
          await this.deleteDocument(doc.id);
          deletedCount++;
          this.logger.debug(`Deleted document ${doc.id}: ${doc.title}`);
        } catch (error) {
          const errorMsg = `Failed to delete document ${doc.id}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      this.logger.log(`Successfully deleted ${deletedCount} out of ${documents.length} documents`);
      
      return {
        deletedCount,
        errors
      };
    } catch (error) {
      this.logger.error('Error deleting all documents:', error);
      throw error;
    }
  }
}