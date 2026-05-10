import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { setPendingReferralCode } from '../lib/referrals';

type AuthMode = 'welcome' | 'signin' | 'signup';

const HERO_TOP = '#C8E6C9';
const HERO_BOT = '#E8F5E9';
const TEXT     = '#1A2C24';
const GRAY     = '#6B7C75';
const GRAY_DIM = '#A0B0A8';
const DANGER   = '#D4183D';
const BORDER   = 'rgba(45,106,79,0.18)';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');

  const clearForm = () => {
    setEmail(''); setPassword('');
    setReferralCode(''); setError(null);
    setShowPassword(false);
  };

  const handleGooglePlaceholder   = () => Alert.alert('Coming soon', 'Google sign-in will be available soon.');
  const handleApplePlaceholder    = () => Alert.alert('Coming soon', 'Apple sign-in will be available soon.');
  const handleFacebookPlaceholder = () => Alert.alert('Coming soon', 'Facebook sign-in will be available soon.');

  const handleSignIn = async () => {
    setError(null);
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: any) {
      setError(e.message || 'Failed to sign in');
    } finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    setError(null);
    if (!email || !password) { setError('Please fill in all required fields'); return; }
    setLoading(true);
    try {
      if (referralCode.trim()) await setPendingReferralCode(referralCode.trim());
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      Alert.alert('Almost there!', 'Check your email to verify your account.', [
        { text: 'OK', onPress: () => { clearForm(); setMode('signin'); } },
      ]);
    } catch (e: any) {
      setError(e.message || 'Failed to sign up');
    } finally { setLoading(false); }
  };

  // ── Welcome ────────────────────────────────────────────────────────────────
  if (mode === 'welcome') {
    return (
      <View style={{ flex: 1, backgroundColor: HERO_TOP }}>
        <LinearGradient
          colors={[HERO_TOP, HERO_BOT]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView edges={['top']} style={s.heroArea}>
          <Image
            source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
            style={s.heroLogo}
            resizeMode="contain"
          />
          <Text style={s.heroTitle}>RoomPear</Text>
          <Text style={s.heroTagline}>Find roommates you actually vibe with</Text>
          <Text style={s.heroSub}>Match based on lifestyle, not just rent.</Text>
        </SafeAreaView>

        <View style={s.card}>
          <SafeAreaView edges={['bottom']} style={s.cardInner}>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => { clearForm(); setMode('signup'); }}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Get Started</Text>
            </TouchableOpacity>

            <View style={[s.orRow, { marginTop: 16 }]}>
              <View style={s.orLine} />
              <Text style={s.orText}>or continue with</Text>
              <View style={s.orLine} />
            </View>

            <View style={s.socialRow}>
              <TouchableOpacity style={s.socialBtn} onPress={handleGooglePlaceholder}>
                <AntDesign name="google" size={20} color={TEXT} />
              </TouchableOpacity>
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={s.socialBtn} onPress={handleApplePlaceholder}>
                  <AntDesign name="apple" size={22} color={TEXT} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.socialBtn} onPress={handleFacebookPlaceholder}>
                <FontAwesome name="facebook" size={20} color={TEXT} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => { clearForm(); setMode('signin'); }}>
              <Text style={s.switchText}>
                Already have an account?{'  '}
                <Text style={s.switchLink}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </View>
    );
  }

  // ── Sign in / Sign up ──────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: HERO_TOP }}>
      <LinearGradient
        colors={[HERO_TOP, HERO_BOT]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView edges={['top']} style={s.formHero}>
        <TouchableOpacity style={s.backBtn} onPress={() => { clearForm(); setMode('welcome'); }}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <Image
          source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
          style={s.formHeroLogo}
          resizeMode="contain"
        />
        <Text style={s.formHeroTitle}>
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </Text>
        <Text style={s.formHeroSub}>
          {mode === 'signin' ? 'Sign in to continue matching' : 'Join RoomPear and find your match'}
        </Text>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[s.card, { flex: 1 }]}>
            <SafeAreaView edges={['bottom']} style={s.formScroll}>
              {error && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={DANGER} style={{ marginRight: 6 }} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              <TextInput
                style={s.input}
                placeholder="Email"
                placeholderTextColor={GRAY_DIM}
                value={email}
                onChangeText={t => { setEmail(t); setError(null); }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />

              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Password"
                  placeholderTextColor={GRAY_DIM}
                  value={password}
                  onChangeText={t => { setPassword(t); setError(null); }}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={GRAY_DIM} />
                </TouchableOpacity>
              </View>

              {mode === 'signup' && (
                <TextInput
                  style={s.input}
                  placeholder="Referral code (optional)"
                  placeholderTextColor={GRAY_DIM}
                  value={referralCode}
                  onChangeText={t => { setReferralCode(t.toUpperCase()); setError(null); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                />
              )}

              <TouchableOpacity
                style={[s.primaryBtn, { marginTop: 8 }, loading && { opacity: 0.6 }]}
                onPress={mode === 'signin' ? handleSignIn : handleSignUp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={s.primaryBtnText}>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                }
              </TouchableOpacity>

              <View style={[s.orRow, { marginTop: 24 }]}>
                <View style={s.orLine} />
                <Text style={s.orText}>or continue with</Text>
                <View style={s.orLine} />
              </View>

              <View style={s.socialRow}>
                <TouchableOpacity style={s.socialBtn} onPress={handleGooglePlaceholder} disabled={loading}>
                  <AntDesign name="google" size={20} color={TEXT} />
                </TouchableOpacity>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={s.socialBtn} onPress={handleApplePlaceholder} disabled={loading}>
                    <AntDesign name="apple" size={22} color={TEXT} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.socialBtn} onPress={handleFacebookPlaceholder} disabled={loading}>
                  <FontAwesome name="facebook" size={20} color={TEXT} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={{ paddingVertical: 8 }}
                onPress={() => { clearForm(); setMode(mode === 'signin' ? 'signup' : 'signin'); }}
                disabled={loading}
              >
                <Text style={s.switchText}>
                  {mode === 'signin' ? "Don't have an account?  " : 'Already have an account?  '}
                  <Text style={s.switchLink}>
                    {mode === 'signin' ? 'Sign Up' : 'Log In'}
                  </Text>
                </Text>
              </TouchableOpacity>

              <Text style={s.disclaimer}>
                By continuing, you agree to RoomPear's Terms and Privacy Policy.
              </Text>
            </SafeAreaView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  heroArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  heroLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  heroTagline: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 8,
    maxWidth: 260,
  },
  heroSub: {
    fontSize: 14,
    color: GRAY,
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
  },
  cardInner: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 12,
  },

  formHero: {
    paddingHorizontal: 28,
    paddingBottom: 32,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  formHeroLogo: {
    width: 56,
    height: 56,
    marginBottom: 12,
  },
  formHeroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  formHeroSub: {
    fontSize: 14,
    color: GRAY,
  },

  formScroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },

  input: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    height: 50,
    paddingHorizontal: 16,
    fontSize: 15,
    color: GRAY,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },

  primaryBtn: {
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: GRAY,
    fontWeight: '500',
  },

  socialRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 16,
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F5F8F6',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  switchText: {
    fontSize: 14,
    color: GRAY,
    textAlign: 'center',
  },
  switchLink: {
    color: TEXT,
    fontWeight: '700',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,24,61,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,24,61,0.20)',
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: DANGER, fontSize: 14, flex: 1 },

  disclaimer: {
    marginTop: 10,
    fontSize: 12,
    color: GRAY_DIM,
    textAlign: 'center',
    lineHeight: 16,
  },
});
