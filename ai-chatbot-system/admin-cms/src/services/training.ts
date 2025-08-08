import { api } from './api';

export const trainingService = {
  async getTrainingJobs() {
    try {
      const response = await api.get('/training/jobs');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch training jobs:', error);
      return [];
    }
  },

  async startTraining(data: any) {
    const response = await api.post('/training/start', data);
    return response.data;
  },

  async stopTraining(jobId: string) {
    const response = await api.post(`/training/${jobId}/stop`);
    return response.data;
  },

  async getTrainingStatus(jobId: string) {
    const response = await api.get(`/training/status/${jobId}`);
    return response.data;
  },
};