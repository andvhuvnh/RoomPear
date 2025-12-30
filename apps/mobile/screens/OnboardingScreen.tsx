/**
 * Onboarding screen for new users to set their housing preferences
 * This screen will be shown to users who haven't completed their preferences yet
 */

import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  useEffect(() => {
    // Get current user to ensure we have a session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        console.error('No user found during onboarding');
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to RoomPear!</Text>
      <Text style={styles.subtitle}>
        Let's set up your housing preferences
      </Text>
      <Text style={styles.hint}>
        Onboarding form will go here...
      </Text>
      <Text style={styles.note}>
        (This is a placeholder - preferences form coming next)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  hint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  note: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

