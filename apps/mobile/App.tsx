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
import ProfileCompletionScreen from './screens/ProfileCompletionScreen';
import ProfileCardScreen from './screens/ProfileCardScreen';
import MainTabNavigator from './navigation/MainTabNavigator';

type AppState = 'loading' | 'auth' | 'onboarding' | 'profile-completion' | 'profile-card' | 'home';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [appState, setAppState] = useState<AppState>('loading');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await checkUserState(session);
      setLoading(false);
    });

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

  const handleOnboardingComplete = async () => {
    if (session) setAppState('profile-completion');
  };

  const handleProfileComplete = async () => {
    if (session) setAppState('profile-card');
  };

  const handleProfileCardComplete = async () => {
    if (session) await checkUserState(session);
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
