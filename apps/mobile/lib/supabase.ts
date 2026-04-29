import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get Supabase URL and anon key from environment variables
// These should be set in .env file (apps/mobile/.env)
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Create a dummy client if credentials are missing (prevents app crash)
// The app will show an error message instead
let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
  // Debug logging
  if (__DEV__) {
    console.error('❌ Supabase Config Missing!');
    console.error('URL:', supabaseUrl || 'NOT SET');
    console.error('Anon Key:', supabaseAnonKey ? 'SET (but may be invalid)' : 'NOT SET');
    console.error('\n⚠️  SETUP REQUIRED:');
    console.error('1. Create apps/mobile/.env file');
    console.error('2. Add your Supabase credentials:');
    console.error('   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
    console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
    console.error('\n3. Get credentials from: https://app.supabase.com/project/_/settings/api');
    console.error('4. Restart Expo (stop and run npm start again)');
  }
  
  // Create a dummy client that will fail with clear errors
  supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseAnonKey || 'placeholder-key', 
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
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
      // AsyncStorage keeps PKCE verifier + session across OAuth in-app browser return (RN has no localStorage).
      storage: AsyncStorage,
    },
    global: {
      headers: {
        'x-client-info': 'roompear-mobile',
      },
    },
  });
  
  // Test connection
  if (__DEV__) {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.warn('Supabase session check error:', error);
      } else {
        console.log('Supabase client initialized successfully');
      }
    });
  }
}

export { supabase };

// Export types for TypeScript (will be generated from Supabase later)
export type Database = any; // TODO: Replace with generated types from Supabase

