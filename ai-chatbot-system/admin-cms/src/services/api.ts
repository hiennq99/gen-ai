import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Clean up any malformed params that might come from React Query
  if (config.params && typeof config.params === 'object') {
    const cleanParams: Record<string, any> = {};

    for (const [key, value] of Object.entries(config.params)) {
      // Skip React Query internal properties and invalid values
      if (
        key !== 'client' &&
        key !== 'signal' &&
        !key.startsWith('queryKey') &&
        value !== undefined &&
        value !== null &&
        typeof value !== 'function' &&
        typeof value !== 'object' &&
        value.toString() !== '[object Object]' &&
        value.toString() !== '[object AbortSignal]'
      ) {
        cleanParams[key] = value;
      }
    }

    config.params = Object.keys(cleanParams).length > 0 ? cleanParams : undefined;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);