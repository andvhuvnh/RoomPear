import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { hasPreferences } from './lib/preferences';
import { profilePhotoPathsFromRow } from './lib/profileDisplay';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainTabNavigator from './navigation/MainTabNavigator';
import ProfileCompletionScreen from './screens/ProfileCompletionScreen';
import ProfileCardScreen from './screens/ProfileCardScreen';

type AppState = 'loading' | 'auth' | 'onboarding' | 'profile-completion' | 'profile-card' | 'home';

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('bio, occupation, hobbies, profile_photo_url')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('checkUserState: profile fetch failed', profileError);
    }

    const photoPaths = profilePhotoPathsFromRow(profile?.profile_photo_url);
    const hasProfileCardPhotos = photoPaths.length >= 3;

    const hasProfileDetails = Boolean(
      profile?.bio?.trim() ||
        profile?.occupation?.trim() ||
        (profile?.hobbies && profile.hobbies.length > 0)
    );

    // Photo card is the final setup step. If bio/occupation/hobbies are all empty (all optional),
    // we must still allow home once 3+ photos are saved — otherwise users loop back to
    // profile-completion forever after finishing the card.
    if (hasProfileCardPhotos) {
      setAppState('home');
      return;
    }

    if (!hasProfileDetails) {
      setAppState('profile-completion');
    } else {
      setAppState('profile-card');
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
      // After profile completion, go to profile card screen
      setAppState('profile-card');
    }
  };

  // Callback for when profile card is done
  const handleProfileCardComplete = async () => {
    if (session) {
      await checkUserState(session);
    }
  };

  if (loading || appState === 'loading') {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingRoot}>
          <ActivityIndicator size="large" color="#0C5389" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {appState === 'auth' && <AuthScreen />}
      {appState === 'onboarding' && (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      )}
      {appState === 'profile-completion' && (
        <ProfileCompletionScreen onComplete={handleProfileComplete} />
      )}
      {appState === 'profile-card' && (
        <ProfileCardScreen onComplete={handleProfileCardComplete} />
      )}
      {appState === 'home' && (
        <NavigationContainer>
          <MainTabNavigator />
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8EEF2',
  },
});
