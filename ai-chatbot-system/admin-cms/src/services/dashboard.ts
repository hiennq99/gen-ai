import { api } from './api';

export const dashboardService = {
  async getStats() {
    try {
      const response = await api.get('/dashboard/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      // Return mock data as fallback
      return {
        totalConversations: 0,
        activeUsers: 0,
        totalDocuments: 0,
        avgResponseTime: 0,
        dailyChats: [],
        emotionDistribution: [],
      };
    }
  },

  async getRecentConversations() {
    try {
      const response = await api.get('/dashboard/recent-conversations');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch recent conversations:', error);
      return [];
    }
  },

  async getSystemHealth() {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      return { status: 'unknown' };
    }
  },
};