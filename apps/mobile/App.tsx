import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { hasPreferences } from './lib/preferences';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';

type AppState = 'loading' | 'auth' | 'onboarding' | 'home';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [appState, setAppState] = useState<AppState>('loading');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session and check preferences
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await checkUserState(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      await checkUserState(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserState = async (session: Session | null) => {
    if (!session) {
      setAppState('auth');
      return;
    }

    // Check if user has completed preferences
    const hasPrefs = await hasPreferences(session.user.id);
    
    if (hasPrefs) {
      setAppState('home');
    } else {
      setAppState('onboarding');
    }
  };

  // Callback for when onboarding is completed
  const handleOnboardingComplete = async () => {
    if (session) {
      await checkUserState(session);
    }
  };

  if (loading || appState === 'loading') {
    return null; // Or a loading screen
  }

  return (
    <>
      <StatusBar style="auto" />
      {appState === 'auth' && <AuthScreen />}
      {appState === 'onboarding' && (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      )}
      {appState === 'home' && <HomeScreen />}
    </>
  );
}
