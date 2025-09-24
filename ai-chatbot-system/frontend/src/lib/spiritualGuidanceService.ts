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

export interface SpiritualDisease {
  name: string;
  arabicName: string;
  pageRange: string;
  emotionalTriggers: string[];
  directQuotes: DirectQuote[];
  quranicEvidence: QuranicEvidence[];
  hadithEvidence: HadithEvidence[];
}

export interface DirectQuote {
  page: number;
  quote: string;
  context: 'symptoms' | 'treatment' | 'evidence' | 'general';
}

export interface QuranicEvidence {
  page: number;
  verse: string;
  reference: string;
}

export interface HadithEvidence {
  page: number;
  hadith: string;
  source: string;
}

export interface SpiritualGuidanceRequest {
  message: string;
  emotionalState?: any;
  conversationHistory?: string[];
}

export interface SpiritualGuidanceResponse {
  response: string;
  citations: DirectQuote[];
  spiritualDisease?: SpiritualDisease;
  citationLevel: 'perfect_match' | 'related_theme' | 'general_guidance' | 'no_direct_match';
  templateUsed: string;
  metadata?: {
    qualityScore?: number;
    qualityChecks?: any;
    qualityPassed?: boolean;
    emotionAnalysis?: any;
    spiritualContext?: boolean;
  };
}

export interface EmotionalState {
  primaryEmotion: string;
  intensity: number;
  triggers: string[];
  context: string;
}

export const spiritualGuidanceService = {
  async getSpiritualGuidance(request: SpiritualGuidanceRequest): Promise<SpiritualGuidanceResponse> {
    const response = await api.post<SpiritualGuidanceResponse>('/spiritual-guidance/guidance', request);
    return response.data;
  },

  async analyzeEmotion(message: string): Promise<EmotionalState> {
    const response = await api.post('/spiritual-guidance/emotion-analysis', { message });
    return response.data.data;
  },

  async getSpiritualDiseases(): Promise<SpiritualDisease[]> {
    const response = await api.get('/spiritual-guidance/spiritual-diseases');
    return response.data.data;
  },

  async getSpiritualDisease(name: string): Promise<SpiritualDisease> {
    const response = await api.get(`/spiritual-guidance/spiritual-diseases/${name}`);
    return response.data.data;
  },

  async testCitationMatching(message: string, emotion?: string): Promise<any> {
    const response = await api.post('/spiritual-guidance/test-citation', {
      message,
      emotion
    });
    return response.data.data;
  },

  async analyzeEmotionalPatterns(messages: string[]): Promise<any> {
    const response = await api.post('/spiritual-guidance/pattern-analysis', {
      messages
    });
    return response.data.data;
  },

  async auditResponseQuality(response: SpiritualGuidanceResponse, originalMessage: string): Promise<any> {
    const auditResponse = await api.post('/spiritual-guidance/quality-audit', {
      response,
      originalMessage
    });
    return auditResponse.data.data;
  },

  async getHealthStatus(): Promise<any> {
    const response = await api.get('/spiritual-guidance/health');
    return response.data;
  }
};