import axios from 'axios';
import { supabase } from '../config/supabase';

// Create axios instance
const axiosInstance = axios.create();

// Add request interceptor to include Supabase session token
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      // Get Supabase session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('Error getting session in request interceptor:', sessionError);
      }
      
      if (session?.access_token) {
        // Send Supabase JWT token for backend validation
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      // Also send user ID for backward compatibility (if backend still needs it)
      if (session?.user?.id) {
        config.headers['X-User-Id'] = session.user.id;
      } else if (session && !session.user?.id) {
        console.warn('Session exists but user.id is missing');
      }
      
      return config;
    } catch (error) {
      console.error('Error in request interceptor:', error);
      return Promise.reject(error);
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // If unauthorized, check if session is still valid
    if (error.response?.status === 401) {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Check if session is actually invalid/expired
        const isSessionExpired = !session || 
          (session.expires_at && session.expires_at * 1000 < Date.now());
        
        // Only sign out if session is truly invalid/expired
        if (sessionError || isSessionExpired) {
          await supabase.auth.signOut();
          // Only redirect if not already on auth pages
          if (window.location.pathname !== '/login' && 
              window.location.pathname !== '/register' && 
              window.location.pathname !== '/forgot-password') {
            window.location.href = '/login';
          }
        }
        // If session exists and is valid but API returns 401, 
        // it might be a backend authentication issue (e.g., backend doesn't support Supabase JWT)
        // Don't sign out, just let the error propagate so components can handle it
      } catch (err) {
        console.error('Error checking session in interceptor:', err);
        // If we can't check session, don't sign out - let the error propagate
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;