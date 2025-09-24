import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
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
  metadata?: any;
}

export interface TrainingData {
  id?: string;
  type: 'spiritual_disease' | 'citation' | 'response_template' | 'handbook_content';
  content: any;
  status: 'active' | 'inactive' | 'pending_review';
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export interface HandbookContent {
  id?: string;
  title: string;
  arabicTitle?: string;
  chapter: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  spiritualDiseases: string[];
  quotes: DirectQuote[];
  quranicVerses: QuranicEvidence[];
  hadithReferences: HadithEvidence[];
  keywords: string[];
  emotionalTriggers: string[];
}

export interface CitationAnalytics {
  totalCitations: number;
  citationsByLevel: Record<string, number>;
  popularDiseases: Array<{ name: string; count: number }>;
  qualityScores: {
    average: number;
    distribution: Record<string, number>;
  };
  responseTime: number;
}

export const spiritualGuidanceService = {
  // Spiritual Diseases Management
  async getSpiritualDiseases(): Promise<SpiritualDisease[]> {
    const response = await api.get('/spiritual-guidance/spiritual-diseases');
    return response.data.data;
  },

  async getSpiritualDisease(name: string): Promise<SpiritualDisease> {
    const response = await api.get(`/spiritual-guidance/spiritual-diseases/${name}`);
    return response.data.data;
  },

  async createSpiritualDisease(disease: Partial<SpiritualDisease>): Promise<SpiritualDisease> {
    const response = await api.post('/admin/spiritual-guidance/diseases', disease);
    return response.data.data;
  },

  async updateSpiritualDisease(name: string, updates: Partial<SpiritualDisease>): Promise<SpiritualDisease> {
    const response = await api.put(`/admin/spiritual-guidance/diseases/${name}`, updates);
    return response.data.data;
  },

  async deleteSpiritualDisease(name: string): Promise<void> {
    await api.delete(`/admin/spiritual-guidance/diseases/${name}`);
  },

  // Handbook Content Management
  async getHandbookContent(filters?: any): Promise<HandbookContent[]> {
    const response = await api.get('/admin/spiritual-guidance/handbook', { params: filters });
    return response.data.data;
  },

  async createHandbookContent(content: Partial<HandbookContent>): Promise<HandbookContent> {
    const response = await api.post('/admin/spiritual-guidance/handbook', content);
    return response.data.data;
  },

  async updateHandbookContent(id: string, updates: Partial<HandbookContent>): Promise<HandbookContent> {
    const response = await api.put(`/admin/spiritual-guidance/handbook/${id}`, updates);
    return response.data.data;
  },

  async deleteHandbookContent(id: string): Promise<void> {
    await api.delete(`/admin/spiritual-guidance/handbook/${id}`);
  },

  // Training Data Management
  async getTrainingData(type?: string): Promise<TrainingData[]> {
    const response = await api.get('/admin/spiritual-guidance/training', {
      params: type ? { type } : {}
    });
    return response.data.data;
  },

  async createTrainingData(data: Partial<TrainingData>): Promise<TrainingData> {
    const response = await api.post('/admin/spiritual-guidance/training', data);
    return response.data.data;
  },

  async updateTrainingData(id: string, updates: Partial<TrainingData>): Promise<TrainingData> {
    const response = await api.put(`/admin/spiritual-guidance/training/${id}`, updates);
    return response.data.data;
  },

  async deleteTrainingData(id: string): Promise<void> {
    await api.delete(`/admin/spiritual-guidance/training/${id}`);
  },

  // Testing & Analytics
  async testGuidance(request: SpiritualGuidanceRequest): Promise<SpiritualGuidanceResponse> {
    const response = await api.post('/spiritual-guidance/guidance', request);
    return response.data;
  },

  async testCitationMatching(message: string, emotion?: string): Promise<any> {
    const response = await api.post('/spiritual-guidance/test-citation', {
      message,
      emotion
    });
    return response.data.data;
  },

  async analyzeEmotionalState(message: string): Promise<any> {
    const response = await api.post('/spiritual-guidance/emotion-analysis', {
      message
    });
    return response.data.data;
  },

  async getAnalytics(): Promise<CitationAnalytics> {
    const response = await api.get('/admin/spiritual-guidance/analytics');
    return response.data.data;
  },

  async auditResponse(response: SpiritualGuidanceResponse, originalMessage: string): Promise<any> {
    const auditResponse = await api.post('/spiritual-guidance/quality-audit', {
      response,
      originalMessage
    });
    return auditResponse.data.data;
  },

  // Bulk Operations
  async importHandbookContent(file: File): Promise<{ success: number; errors: any[] }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/admin/spiritual-guidance/import/handbook', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async exportTrainingData(format: 'json' | 'csv' | 'xlsx' = 'json'): Promise<Blob> {
    const response = await api.get(`/admin/spiritual-guidance/export/training`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  },

  async validateTrainingData(): Promise<{
    valid: number;
    invalid: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const response = await api.post('/admin/spiritual-guidance/validate');
    return response.data;
  },

  // System Health
  async getHealthStatus(): Promise<any> {
    const response = await api.get('/spiritual-guidance/health');
    return response.data;
  }
};