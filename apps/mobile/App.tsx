import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { hasPreferences } from './lib/preferences';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import ProfileCompletionScreen from './screens/ProfileCompletionScreen';

type AppState = 'loading' | 'auth' | 'onboarding' | 'profile-completion' | 'home';

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
    
    if (!hasPrefs) {
      setAppState('onboarding');
      return;
    }

    // Check if user has completed profile (has bio, occupation, or hobbies)
    const { data: profile } = await supabase
      .from('profiles')
      .select('bio, occupation, hobbies')
      .eq('id', session.user.id)
      .single();

    // Show profile completion if user hasn't added any profile details
    // They can skip, but we'll show it if they haven't filled anything
    const hasProfileDetails = profile?.bio || profile?.occupation || (profile?.hobbies && profile.hobbies.length > 0);
    
    if (!hasProfileDetails) {
      setAppState('profile-completion');
    } else {
      setAppState('home');
    }
  };

  // Callback for when onboarding is completed
  const handleOnboardingComplete = async () => {
    if (session) {
      // After onboarding, go to profile completion
      setAppState('profile-completion');
    }
  };

  // Callback for when profile completion is done
  const handleProfileComplete = async () => {
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
      {appState === 'profile-completion' && (
        <ProfileCompletionScreen onComplete={handleProfileComplete} />
      )}
      {appState === 'home' && <HomeScreen />}
    </>
  );
}
