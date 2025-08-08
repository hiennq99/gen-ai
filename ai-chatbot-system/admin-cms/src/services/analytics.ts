import { api } from './api';

export const analyticsService = {
  async getAnalytics(params?: any) {
    try {
      const response = await api.get('/analytics', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Return empty data structure as fallback
      return {
        totalConversations: 0,
        uniqueUsers: 0,
        avgResponseTime: 0,
        successRate: 0,
        responseTime: [],
        emotionDistribution: [],
        hourlyActivity: [],
        confidenceScore: [],
      };
    }
  },

  async getMetrics(metric: string, params?: any) {
    const response = await api.get(`/analytics/metrics/${metric}`, { params });
    return response.data;
  },

  async generateReport(params: any) {
    const response = await api.post('/analytics/report', params);
    return response.data;
  },
};