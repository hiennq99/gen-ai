// Common types shared across all workspaces

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  sessionId?: string;
  emotion?: string;
  confidence?: number;
  media?: MediaItem[];
}

export interface MediaItem {
  type: 'image' | 'video' | 'document' | 'suggestion';
  url?: string;
  caption?: string;
  content?: string;
}

export interface ChatSession {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'ended';
  metadata?: Record<string, any>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'txt' | 'qa' | 'image';
  size: number;
  uploadedAt: Date;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

export interface EmotionAnalysis {
  primaryEmotion: string;
  confidence: number;
  emotions: Record<string, number>;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
  media?: MediaItem;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Request/Response types
export interface ChatRequest {
  message: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  id: string;
  content: string;
  media?: MediaItem[];
  emotion?: string;
  confidence?: number;
  processingTime?: number;
  metadata?: Record<string, any>;
}