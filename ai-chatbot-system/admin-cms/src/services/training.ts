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

  async getTrainingData() {
    try {
      const response = await api.get('/training');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch training data:', error);
      return [];
    }
  },

  async getQAData() {
    try {
      const response = await api.get('/training/qa');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch Q&A data:', error);
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

  async uploadCSV(file: File, options: {
    name?: string;
    description?: string;
    questionColumn?: string;
    answerColumn?: string;
  }) {
    const formData = new FormData();
    formData.append('file', file);

    if (options.name) formData.append('name', options.name);
    if (options.description) formData.append('description', options.description);
    if (options.questionColumn) formData.append('questionColumn', options.questionColumn);
    if (options.answerColumn) formData.append('answerColumn', options.answerColumn);

    const response = await api.post('/training/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async clearAllQAData() {
    try {
      const response = await api.delete('/training/qa/all');
      return response.data;
    } catch (error) {
      console.error('Failed to clear Q&A data:', error);
      throw error;
    }
  },
};