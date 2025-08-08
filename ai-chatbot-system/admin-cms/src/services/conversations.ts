import { api } from './api';

export const conversationsService = {
  async getConversations(filters?: any) {
    try {
      const response = await api.get('/conversations', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      return [];
    }
  },

  async getConversation(sessionId: string) {
    const response = await api.get(`/conversations/${sessionId}`);
    return response.data;
  },

  async exportConversations(filters: any) {
    const response = await api.post('/conversations/export', filters, {
      responseType: 'blob',
    });
    return response.data;
  },

  async deleteConversation(sessionId: string) {
    const response = await api.delete(`/conversations/${sessionId}`);
    return response.data;
  },
};