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
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { setPendingReferralCode } from '../lib/referrals';

type AuthMode = 'welcome' | 'signin' | 'signup';

const C = {
  bg: '#1A1D2E',
  bg2: '#252938',
  lime: '#84CC16',
  limeDark: '#65A30D',
  white: '#FDFDFD',
  gray: '#B0B0B8',
  grayDim: '#6B7280',
  surface: 'rgba(255,255,255,0.06)',
  surfaceBorder: 'rgba(255,255,255,0.10)',
  inputBg: 'rgba(255,255,255,0.08)',
  inputBorder: 'rgba(255,255,255,0.15)',
  danger: '#F87171',
  success: '#4ADE80',
};

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');

  const clearForm = () => {
    setEmail(''); setPassword(''); setName(''); setPhone('');
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
    if (!email || !password || !name || !phone) {
      setError('Please fill in all required fields'); return;
    }
    const phoneRegex = /^[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid phone number'); return;
    }
    setLoading(true);
    try {
      if (referralCode.trim()) {
        await setPendingReferralCode(referralCode.trim());
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name: name.trim(), phone: phone.trim() } },
      });
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
      <View style={styles.welcomeContainer}>
        {/* Glow blobs */}
        <View style={styles.glowTL} />
        <View style={styles.glowBR} />

        {/* Floating card decorations */}
        <View style={[styles.floatCard, styles.floatCardTL]} />
        <View style={[styles.floatCard, styles.floatCardTR]} />
        <View style={[styles.floatCard, styles.floatCardBL]} />
        <View style={[styles.floatCard, styles.floatCardBR]} />

        {/* Center content */}
        <View style={styles.welcomeContent}>
          <Text style={styles.pearEmoji}>🍐</Text>
          <Text style={styles.welcomeTitle}>RoomPear</Text>
          <Text style={styles.welcomeTagline}>Find roommates you actually vibe with</Text>
          <Text style={styles.welcomeSub}>Match based on lifestyle, not just rent.</Text>

          {/* Start Matching CTA */}
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => { clearForm(); setMode('signup'); }}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>Start Matching</Text>
          </TouchableOpacity>

          {/* OR divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          {/* Social buttons */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn} onPress={handleGooglePlaceholder}>
              <AntDesign name="google" size={22} color={C.white} />
            </TouchableOpacity>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.socialBtn} onPress={handleApplePlaceholder}>
                <AntDesign name="apple" size={22} color={C.white} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.socialBtn} onPress={handleFacebookPlaceholder}>
              <FontAwesome name="facebook" size={22} color={C.white} />
            </TouchableOpacity>
          </View>

          {/* Log in link */}
          <TouchableOpacity onPress={() => { clearForm(); setMode('signin'); }}>
            <Text style={styles.loginLink}>
              Already have an account?{' '}
              <Text style={styles.loginLinkBold}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.formContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => { clearForm(); setMode('welcome'); }}>
            <AntDesign name="arrow-left" size={22} color={C.white} />
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

          {mode === 'signup' && (
            <>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={C.grayDim}
                value={name}
                onChangeText={t => { setName(t); setError(null); }}
                autoCapitalize="words"
                editable={!loading}
              />
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="(555) 123-4567"
                placeholderTextColor={C.grayDim}
                value={phone}
                onChangeText={t => { setPhone(t); setError(null); }}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </>
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

          {/* CTA — 36px gap from last input, matches Airbnb/Linear pattern */}
          <TouchableOpacity
            style={[styles.startBtn, styles.formCta, loading && { opacity: 0.6 }]}
            onPress={mode === 'signin' ? handleSignIn : handleSignUp}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.bg} />
              : <Text style={styles.startBtnText}>
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
              <AntDesign name="google" size={22} color={C.white} />
            </TouchableOpacity>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.socialBtn} onPress={handleApplePlaceholder} disabled={loading}>
                <AntDesign name="apple" size={22} color={C.white} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.socialBtn} onPress={handleFacebookPlaceholder} disabled={loading}>
              <FontAwesome name="facebook" size={22} color={C.white} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => { clearForm(); setMode(mode === 'signin' ? 'signup' : 'signin'); }}
            disabled={loading}
          >
            <Text style={styles.loginLink}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.loginLinkBold}>
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
  );
}

const styles = StyleSheet.create({
  // ── Welcome ─────────────────────────────────────────────────
  welcomeContainer: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  glowTL: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: C.lime,
    opacity: 0.12,
  },
  glowBR: {
    position: 'absolute',
    bottom: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.lime,
    opacity: 0.10,
  },

  floatCard: {
    position: 'absolute',
    width: 100,
    height: 140,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  floatCardTL: { top: 60, left: -22, transform: [{ rotate: '-12deg' }] },
  floatCardTR: { top: 80, right: -18, transform: [{ rotate: '10deg' }] },
  floatCardBL: { bottom: 100, left: -18, transform: [{ rotate: '8deg' }] },
  floatCardBR: { bottom: 80, right: -24, transform: [{ rotate: '-10deg' }] },

  welcomeContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  pearEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  welcomeTagline: {
    fontSize: 20,
    fontWeight: '700',
    color: C.white,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 26,
  },
  welcomeSub: {
    fontSize: 15,
    color: C.gray,
    textAlign: 'center',
    marginBottom: 36,
  },

  startBtn: {
    width: '100%',
    backgroundColor: C.lime,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: C.lime,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  startBtnText: {
    color: '#0F1A00',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  orText: { marginHorizontal: 12, fontSize: 13, color: C.grayDim, fontWeight: '600' },

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

  loginLink: {
    fontSize: 15,
    color: C.gray,
    textAlign: 'center',
  },
  loginLinkBold: {
    color: C.lime,
    fontWeight: '700',
  },

  // ── Form ────────────────────────────────────────────────────
  formContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  formHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: C.white,
    marginBottom: 6,
  },
  formSub: {
    fontSize: 14,
    color: C.gray,
    textAlign: 'center',
  },

  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.30)',
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: C.danger, fontSize: 14 },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gray,
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.inputBorder,
    color: C.white,
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
