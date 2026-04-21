import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { setPendingReferralCode } from '../lib/referrals';

type AuthMode = 'welcome' | 'signin' | 'signup';

const C = {
  bg:            '#1A3329',
  surface:       'rgba(255,255,255,0.82)',
  surfaceBorder: 'rgba(255,255,255,0.45)',
  inputBg:       'rgba(255,255,255,0.70)',
  inputBorder:   'rgba(0,0,0,0.08)',
  text:          '#1A2C24',
  gray:          '#717182',
  grayDim:       '#A0A0B0',
  cta:           '#030213',
  danger:        '#D4183D',
  accent:        '#2D4F42',
};

const GRAD = ['#1A3329','#2D4F42','#5A806B','#9CB8A8','#D8E8DF','#F5FAF7','#FFFFFF'] as const;
const LOCS = [0, 0.06, 0.14, 0.28, 0.48, 0.72, 1] as const;

function Background({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient
        colors={GRAD}
        locations={LOCS}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <BlurView
        intensity={Platform.OS === 'ios' ? 52 : 34}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');

  const clearForm = () => {
    setEmail(''); setPassword('');
    setReferralCode(''); setError(null);
  };

  const handleGooglePlaceholder = () =>
    Alert.alert('Coming soon', 'Google sign-in will be available soon.');
  const handleApplePlaceholder = () =>
    Alert.alert('Coming soon', 'Apple sign-in will be available soon.');
  const handleFacebookPlaceholder = () =>
    Alert.alert('Coming soon', 'Facebook sign-in will be available soon.');

  const handleSignIn = async () => {
    setError(null);
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: any) {
      setError(e.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (!email || !password) {
      setError('Please fill in all required fields'); return;
    }
    setLoading(true);
    try {
      if (referralCode.trim()) {
        await setPendingReferralCode(referralCode.trim());
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      Alert.alert('Almost there!', 'Check your email to verify your account.', [
        { text: 'OK', onPress: () => { clearForm(); setMode('signin'); } },
      ]);
    } catch (e: any) {
      setError(e.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'welcome') {
    return (
      <Background>
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeTop}>
            <Text style={styles.pearEmoji}>🍐</Text>
            <Text style={styles.welcomeTitle}>RoomPear</Text>
            <Text style={styles.welcomeTagline}>Find roommates you actually vibe with</Text>
            <Text style={styles.welcomeSub}>Match based on lifestyle, not just rent.</Text>
          </View>

          <View style={styles.welcomeBottom}>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => { clearForm(); setMode('signup'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>Get Started</Text>
            </TouchableOpacity>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} onPress={handleGooglePlaceholder}>
                <AntDesign name="google" size={20} color={C.text} />
              </TouchableOpacity>
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.socialBtn} onPress={handleApplePlaceholder}>
                  <AntDesign name="apple" size={20} color={C.text} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.socialBtn} onPress={handleFacebookPlaceholder}>
                <FontAwesome name="facebook" size={20} color={C.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => { clearForm(); setMode('signin'); }}>
              <Text style={styles.switchLink}>
                Already have an account?{'  '}
                <Text style={styles.switchLinkBold}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Background>
    );
  }

  return (
    <Background>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => { clearForm(); setMode('welcome'); }}>
              <AntDesign name="arrow-left" size={20} color={C.text} />
            </TouchableOpacity>

            <View style={styles.formHeader}>
              <Text style={styles.pearEmoji}>🍐</Text>
              <Text style={styles.formTitle}>
                {mode === 'signin' ? 'Welcome back' : 'Create account'}
              </Text>
              <Text style={styles.formSub}>
                {mode === 'signin'
                  ? 'Sign in to continue matching'
                  : 'Join RoomPear and find your match'}
              </Text>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}


            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={C.grayDim}
              value={email}
              onChangeText={t => { setEmail(t); setError(null); }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={C.grayDim}
              value={password}
              onChangeText={t => { setPassword(t); setError(null); }}
              secureTextEntry
              editable={!loading}
            />

            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Referral code (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. A1B2C3D4"
                  placeholderTextColor={C.grayDim}
                  value={referralCode}
                  onChangeText={t => { setReferralCode(t.toUpperCase()); setError(null); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.ctaBtn, styles.formCta, loading && { opacity: 0.6 }]}
              onPress={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.ctaBtnText}>
                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  </Text>
              }
            </TouchableOpacity>

            <View style={[styles.orRow, { marginTop: 8 }]}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or continue with</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} onPress={handleGooglePlaceholder} disabled={loading}>
                <AntDesign name="google" size={20} color={C.text} />
              </TouchableOpacity>
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.socialBtn} onPress={handleApplePlaceholder} disabled={loading}>
                  <AntDesign name="apple" size={20} color={C.text} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.socialBtn} onPress={handleFacebookPlaceholder} disabled={loading}>
                <FontAwesome name="facebook" size={20} color={C.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.switchModeBtn}
              onPress={() => { clearForm(); setMode(mode === 'signin' ? 'signup' : 'signin'); }}
              disabled={loading}
            >
              <Text style={styles.switchLink}>
                {mode === 'signin' ? "Don't have an account?  " : 'Already have an account?  '}
                <Text style={styles.switchLinkBold}>
                  {mode === 'signin' ? 'Sign Up' : 'Log In'}
                </Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              By continuing, you agree to RoomPear's Terms and Privacy Policy.
            </Text>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Background>
  );
}

const styles = StyleSheet.create({
  // ── Welcome ─────────────────────────────────────────────────
  welcomeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 52,
  },
  welcomeTop: {
    alignItems: 'center',
  },
  pearEmoji: {
    fontSize: 64,
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 44,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  welcomeTagline: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  welcomeSub: {
    fontSize: 15,
    color: C.gray,
    textAlign: 'center',
  },
  welcomeBottom: {
    width: '100%',
  },

  // ── Shared ──────────────────────────────────────────────────
  ctaBtn: {
    width: '100%',
    backgroundColor: C.cta,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.15)' },
  orText: { marginHorizontal: 12, fontSize: 13, color: C.gray, fontWeight: '500' },

  socialRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
    justifyContent: 'center',
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  switchLink: {
    fontSize: 15,
    color: C.gray,
    textAlign: 'center',
  },
  switchLinkBold: {
    color: C.text,
    fontWeight: '700',
  },

  // ── Form ────────────────────────────────────────────────────
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },

  formHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  formTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
  },
  formSub: {
    fontSize: 15,
    color: C.gray,
    textAlign: 'center',
  },

  errorBox: {
    backgroundColor: 'rgba(212,24,61,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,24,61,0.20)',
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: C.danger, fontSize: 14 },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gray,
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.inputBorder,
    color: C.text,
  },

  formCta: {
    marginTop: 36,
  },
  switchModeBtn: {
    marginTop: 8,
    paddingVertical: 8,
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 12,
    color: C.grayDim,
    textAlign: 'center',
    lineHeight: 16,
  },
});
