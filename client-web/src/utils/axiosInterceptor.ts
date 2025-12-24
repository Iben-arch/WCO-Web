import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AuthContextType } from '../types';

let authContext: AuthContextType | null = null;

export const setAuthContext = (context: AuthContextType): void => {
  authContext = context;
};

// Request interceptor to add Authorization header
axios.interceptors.request.use(
  (config) => {
    // Skip adding Authorization header for refresh token endpoint
    if (config.url?.includes('/auth/refresh-token')) {
      return config;
    }

    // Get token from localStorage
    const token = localStorage.getItem('authToken');
    if (token) {
      // สร้าง headers object ถ้ายังไม่มี
      if (!config.headers) {
        config.headers = {} as any;
      }
      
      // เพิ่ม Authorization header
      // สำหรับ FormData axios จะไม่ลบ headers ที่มีอยู่
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

    // Skip token refresh for refresh token endpoint itself to avoid infinite loop
    if (originalRequest.url?.includes('/auth/refresh-token')) {
      return Promise.reject(error);
    }

    // Check if the error is due to expired token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        if (authContext && authContext.refreshToken) {
          const newToken = await authContext.refreshToken();
          
          if (newToken) {
            // Update Authorization header with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            } else {
              originalRequest.headers = {
                Authorization: `Bearer ${newToken}`
              } as any;
            }
            
            // Retry the original request with new token
            return axios(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // If refresh fails, redirect to login or handle as needed
        if (authContext && authContext.logout) {
          await authContext.logout();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axios;

