export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  messages: Message[];
  context?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  metadata?: {
    userId?: string;
    sessionId?: string;
    emotion?: string;
    intent?: string;
  };
}

export interface ChatResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  processingTime: number;
  modelId: string;
  metadata?: Record<string, any>;
  error?: string;
}

export type StreamHandler = (chunk: string) => void | Promise<void>;

export interface EmbeddingRequest {
  text: string;
  modelId?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  modelId: string;
}