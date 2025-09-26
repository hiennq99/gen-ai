import { api } from './api';

export const documentsService = {
  async getDocuments(params?: any) {
    try {
      // Clean up params to avoid sending React Query internal objects
      const cleanParams = params && typeof params === 'object' ?
        Object.fromEntries(
          Object.entries(params).filter(([_, value]) =>
            value !== undefined &&
            value !== null &&
            typeof value !== 'function' &&
            typeof value !== 'object'
          )
        ) : {};

      const response = await api.get('/documents', {
        params: Object.keys(cleanParams).length > 0 ? cleanParams : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      return [];
    }
  },

  async uploadDocument(formData: FormData) {
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async deleteDocument(id: string) {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  async importQA(data: any) {
    const response = await api.post('/documents/import-qa', data);
    return response.data;
  },

  async searchDocuments(query: string, options?: any) {
    const response = await api.get('/documents/search', {
      params: { q: query, ...options },
    });
    return response.data;
  },
};