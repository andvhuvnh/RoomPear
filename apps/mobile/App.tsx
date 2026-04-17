import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { hasPreferences } from './lib/preferences';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainTabNavigator from './navigation/MainTabNavigator';
import { redeemPendingReferralIfAny } from './lib/referrals';

type AppState = 'loading' | 'auth' | 'onboarding' | 'home';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [appState, setAppState] = useState<AppState>('loading');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mapboxToken = Constants.expoConfig?.extra?.mapboxAccessToken as string | undefined;
    if (!mapboxToken || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
    try {
      const Mapbox = require('@rnmapbox/maps').default;
      Mapbox.setAccessToken(mapboxToken);
    } catch {
      // Dev client built without Mapbox — onboarding uses legacy location fields.
    }
  }, []);

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

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const r = await redeemPendingReferralIfAny();
      if (cancelled || !r?.success) return;
      Alert.alert(
        'Referral applied',
        'You and your friend each earned a bonus reveal for Likes.'
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const checkUserState = async (session: Session | null) => {
    if (!session) {
      setAppState('auth');
      return;
    }

    const hasPrefs = await hasPreferences(session.user.id);
    setAppState(hasPrefs ? 'home' : 'onboarding');
  };

  const handleOnboardingComplete = () => setAppState('home');

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
      {appState === 'home' && (
        <NavigationContainer>
          <MainTabNavigator onDevShowOnboarding={__DEV__ ? () => setAppState('onboarding') : undefined} />
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
