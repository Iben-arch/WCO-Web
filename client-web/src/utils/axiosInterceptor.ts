import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AuthContextType } from '../types';

let authContext: AuthContextType | null = null;

export const setAuthContext = (context: AuthContextType): void => {
  authContext = context;
};

// Request interceptor to add Authorization header
axios.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if the error is due to expired token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        if (authContext && authContext.refreshToken) {
          await authContext.refreshToken();
          
          // Retry the original request with new token
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // If refresh fails, redirect to login or handle as needed
        if (authContext && authContext.logout) {
          await authContext.logout();
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axios;

