export interface Document {
  id: string;
  title: string;
  type: string;
  size: number;
  content?: string;  // The actual text content of the document
  s3Url?: string;
  uploadedAt: number | string | Date;
  uploadedAtISO?: string;
  processedAt?: number | string | Date;
  processedAtISO?: string;
  status: 'pending' | 'processing' | 'processed' | 'completed' | 'failed';
  metadata?: any;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  metadata?: any;
}

export interface ProcessingResult {
  documentId: string;
  chunksCreated: number;
  status: string;
  error?: string;
}