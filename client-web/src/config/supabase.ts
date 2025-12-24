// Supabase configuration
// Note: Client-side authentication is handled through backend API
// This file is kept for future direct Supabase client usage if needed

const supabaseConfig = {
  url: process.env.REACT_APP_SUPABASE_URL || "https://ozdbnrlztetdadfegkyu.supabase.co",
  anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || "sb_publishable_OeD3mgjO1wbHBnKosyywwg_Y6AwxnF7"
};

export default supabaseConfig;

