import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const conversationService = {
  // Get all conversations
  async getAllConversations(filters?: {
    userId?: string;
    search?: string;
    emotion?: string;
    startDate?: string;
    endDate?: string;
  }) {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
      }

      // Add cache-busting timestamp
      params.append('_t', Date.now().toString());

      const response = await api.get(`/conversations?${params.toString()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  },

  // Get specific conversation/session
  async getConversation(sessionId: string) {
    try {
      const response = await api.get(`/conversations/${sessionId}`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching conversation:', error);
      return [];
    }
  },

  // Delete conversation
  async deleteConversation(sessionId: string) {
    const response = await api.delete(`/conversations/${sessionId}`);
    return response.data;
  },

  // Export conversations
  async exportConversations(filters?: any) {
    const response = await api.post('/conversations/export', filters || {});
    return response.data;
  },
};