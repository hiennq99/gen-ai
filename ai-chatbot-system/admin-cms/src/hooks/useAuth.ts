import { useState, useEffect } from 'react';
import { authService } from '@/services/auth';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('authToken') !== null;
  });
  const [user, setUser] = useState<User | null>(() => {
    return authService.getCurrentUser();
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const validateAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const isValid = await authService.validateToken();
          if (!isValid) {
            // Only logout if we explicitly get false, not on error
            const hasToken = localStorage.getItem('authToken');
            if (!hasToken) {
              await logout();
            }
          } else {
            const currentUser = authService.getCurrentUser();
            if (currentUser) {
              setUser(currentUser);
            }
          }
        } catch (error) {
          console.error('Auth validation failed:', error);
          // Don't logout on validation error, keep the session
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          }
        }
      }
    };

    validateAuth();
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authService.login({ username, password });
      setIsAuthenticated(true);
      setUser(response.user);
      return true;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const refreshToken = async () => {
    try {
      await authService.refreshToken();
      return true;
    } catch {
      await logout();
      return false;
    }
  };

  return {
    isAuthenticated,
    user,
    login,
    logout,
    refreshToken,
    isLoading,
  };
}