import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase URL and anon key from environment variables
// These should be set in .env file (apps/mobile/.env)
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Create a dummy client if credentials are missing (prevents app crash)
// The app will show an error message instead
let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  // Debug logging
  if (__DEV__) {
    console.warn('⚠️ Supabase Config Missing!');
    console.log('URL:', supabaseUrl ? '✅' : '❌');
    console.log('Anon Key:', supabaseAnonKey ? '✅' : '❌');
    console.log('\nPlease create apps/mobile/.env with:');
    console.log('EXPO_PUBLIC_SUPABASE_URL=your-project-url');
    console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
    console.log('\nGet credentials from: https://app.supabase.com/project/_/settings/api');
    console.log('Then restart Expo (stop and run npm start again)');
  }
  
  // Create a dummy client to prevent crashes
  // This will fail on actual API calls, but allows the app to load
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
} else {
  // Debug logging (remove in production)
  if (__DEV__) {
    console.log('✅ Supabase Config Loaded');
  }
  
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export { supabase };

// Export types for TypeScript (will be generated from Supabase later)
export type Database = any; // TODO: Replace with generated types from Supabase

