import axios from 'axios';
import { supabase } from '../config/supabase';

// Create axios instance with default timeout (ป้องกัน loading ค้างเมื่อ server ช้าหรือไม่ตอบ)
const axiosInstance = axios.create({
  timeout: 15000, // 15 วินาที
});

// Cache session เพื่อลดการเรียก getSession ทุก request (TTL 5 วินาที)
let sessionCache: { session: { access_token?: string; user?: { id?: string } } | null; timestamp: number } | null = null;
const SESSION_CACHE_TTL_MS = 5000;

export const clearSessionCache = (): void => {
  sessionCache = null;
};

// Add request interceptor to include Supabase session token
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const now = Date.now();
      if (sessionCache && (now - sessionCache.timestamp) < SESSION_CACHE_TTL_MS) {
        const session = sessionCache.session;
        if (session?.access_token) {
          config.headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        if (session?.user?.id) {
          config.headers['X-User-Id'] = session.user.id;
        }
        return config;
      }

      // ใช้ timeout ป้องกัน getSession ค้าง (เช่น Supabase ช้า/ไม่ตอบ)
      const SESSION_TIMEOUT_MS = 5000;
      let result: { data: { session: { access_token?: string; user?: { id?: string }; expires_at?: number } | null }; error: unknown };
      try {
        result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Session timeout')), SESSION_TIMEOUT_MS)
          )
        ]);
      } catch (e) {
        console.warn('Session check timed out - proceeding without auth');
        result = { data: { session: null }, error: null };
      }
      const { data: { session }, error: sessionError } = result;
      sessionCache = { session: session ?? null, timestamp: now };
      
      if (sessionError) {
        console.warn('Error getting session in request interceptor:', sessionError);
      }
      
      if (session?.access_token) {
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      if (session?.user?.id) {
        config.headers['X-User-Id'] = session.user.id;
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
          sessionCache = null;
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