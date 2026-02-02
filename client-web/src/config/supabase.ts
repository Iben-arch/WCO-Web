import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment variables
// Note: Create React App uses REACT_APP_ prefix, Vite uses VITE_ prefix
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ozdbnrlztetdadfegkyu.supabase.co";
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_OeD3mgjO1wbHBnKosyywwg_Y6AwxnF7";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Create and export Supabase client singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export default supabase;

