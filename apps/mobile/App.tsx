import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { hasPreferences } from './lib/preferences';
import { registerForPushNotifications } from './lib/notifications';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainTabNavigator from './navigation/MainTabNavigator';
import { redeemPendingReferralIfAny } from './lib/referrals';
import PearLoader from './components/PearLoader';
import { PurchasesProvider } from './context/PurchasesContext';
import { DiscoverDeckProvider } from './context/DiscoverDeckContext';

type AppState = 'loading' | 'auth' | 'onboarding' | 'home';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [appState, setAppState] = useState<AppState>('loading');
  const [loading, setLoading] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_700Bold,
  });

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
      if (session?.user?.id) {
        supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', session.user.id);
      }
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
    registerForPushNotifications(session.user.id);
  };

  const handleOnboardingComplete = () => setAppState('home');

  if ((!fontsLoaded && !fontError) || loading || appState === 'loading') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={styles.loadingRoot}>
            <PearLoader />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        {appState === 'auth' && <AuthScreen />}
        {appState === 'onboarding' && (
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        )}
        {appState === 'home' && session?.user && (
          <PurchasesProvider userId={session.user.id}>
            <DiscoverDeckProvider userId={session.user.id}>
              <NavigationContainer>
                <MainTabNavigator onDevShowOnboarding={__DEV__ ? () => setAppState('onboarding') : undefined} />
              </NavigationContainer>
            </DiscoverDeckProvider>
          </PurchasesProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F7F0',
  },
});
