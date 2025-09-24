import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ChatRequest {
  message: string;
  sessionId?: string;
  userId?: string;
  metadata?: any;
}

export interface ChatResponse {
  id: string;
  content: string;
  media?: any[];
  emotion?: string;
  confidence: number;
  processingTime: number;
  metadata?: any;
}

export const chatService = {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/chat/message', request);
    return response.data;
  },

  async sendSpiritualGuidanceMessage(request: ChatRequest): Promise<ChatResponse> {
    // Use the spiritual guidance chat endpoint
    const response = await api.post<ChatResponse>('/chat/spiritual-guidance', request);
    return response.data;
  },

  async createSession(userId: string) {
    const response = await api.post('/chat/session/create', { userId });
    return response.data;
  },

  async selectEmotion(sessionId: string, userId: string, emotion: string) {
    const response = await api.post<ChatResponse>('/chat/session/emotion', {
      sessionId,
      userId,
      emotion,
    });
    return response.data;
  },

  async endSession(sessionId: string) {
    const response = await api.post(`/chat/session/${sessionId}/end`);
    return response.data;
  },

  async getEmotionAnalysis(text: string) {
    const response = await api.post('/emotion/analyze', { text });
    return response.data;
  },
  
  async getSessionHistory(sessionId: string) {
    const response = await api.get(`/chat/session/${sessionId}/history`);
    return response.data;
  },
};