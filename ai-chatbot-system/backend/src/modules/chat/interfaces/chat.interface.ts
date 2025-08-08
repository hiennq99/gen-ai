import { EmotionType } from '../../emotion/interfaces/emotion.interface';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  userId?: string;
  metadata?: {
    channel?: 'web' | 'zalo' | 'api';
    language?: 'en' | 'vi';
    deviceInfo?: any;
    exactMatch?: boolean;  // Return exact document content without AI
    mode?: 'exact' | 'ai' | 'hybrid';  // Response mode
  };
}

export interface ChatResponse {
  id: string;
  content: string;
  media?: MediaAttachment[];
  emotion?: EmotionType;
  confidence: number;
  processingTime: number;
  metadata?: any;
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'document' | 'suggestion';
  url?: string;
  content?: string;
  caption?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  messages: ChatMessage[];
  metadata: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotion?: EmotionType;
  metadata?: any;
}