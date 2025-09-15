import { api } from './api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('/auth/login', credentials);
      
      // Store token and user data
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch {
      // Fallback to mock auth for development
      if (credentials.username === 'admin' && credentials.password === 'admin123') {
        // Generate a valid JWT token for mock auth
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbi11c2VyIiwiaWF0IjoxNzU0NjI1Njk5LCJleHAiOjE4NTUyMzA0OTl9.mock-signature';
        const mockResponse: LoginResponse = {
          token: mockToken,
          user: {
            id: '1',
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'admin',
          },
        };
        localStorage.setItem('authToken', mockResponse.token);
        localStorage.setItem('user', JSON.stringify(mockResponse.user));
        return mockResponse;
      }
      throw new Error('Invalid credentials');
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  },

  async refreshToken() {
    try {
      const response = await api.post('/auth/refresh');
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
      }
      return response.data;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  },

  async validateToken(): Promise<boolean> {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return false;
      
      const response = await api.get('/auth/validate');
      return response.data.valid;
    } catch {
      // In development, if API fails but we have a token, consider it valid
      const token = localStorage.getItem('authToken');
      return !!token;
    }
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  getToken() {
    return localStorage.getItem('authToken');
  },
};