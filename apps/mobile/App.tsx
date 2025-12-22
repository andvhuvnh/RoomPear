import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { supabase } from './lib/supabase';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check if Supabase is configured
    const checkConfig = () => {
      const url = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const key = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (url && key && !url.includes('placeholder')) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    };

    checkConfig();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RoomPear</Text>
      <Text style={styles.subtitle}>
        {isConnected ? '✅ Supabase Connected' : '⚠️ Configure Supabase'}
      </Text>
      <Text style={styles.hint}>
        Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
