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
} from 'react-native';
import { supabase } from '../lib/supabase';
import { setPendingReferralCode } from '../lib/referrals';

type AuthMode = 'signin' | 'signup';

const COLORS = {
  blue: '#0C5389',
  teal: '#189AA2',
  green: '#46BD7F',
  white: '#FDFDFD',
  ink: '#0B1B2B',
  text: '#2B3A4A',
  border: '#D9E1E6',
  placeholder: '#7B8A99',
  dangerBg: '#FFEBEE',
  dangerBorder: '#FFCDD2',
  dangerText: '#C62828',
  successBg: '#E8F5E9',
  successBorder: '#C8E6C9',
  successText: '#2E7D32',
};

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');

  const handleGooglePlaceholder = () => {
    Alert.alert('Coming soon', 'Google sign-in will be available soon.');
  };

  const handleApplePlaceholder = () => {
    Alert.alert('Coming soon', 'Apple sign-in will be available soon.');
  };

  const handleFacebookPlaceholder = () => {
  Alert.alert('Coming soon', 'Facebook sign-in will be available soon.');
  };

  const handleSignIn = async () => {
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      const errorMsg = 'Please fill in all fields';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setSuccess('Signed in successfully!');
      console.log('Sign in successful!', data);
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to sign in';
      setError(errorMsg);
      Alert.alert('Sign In Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    setSuccess(null);

    if (!email || !password || !name || !phone) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!password) missingFields.push('password');
      if (!name) missingFields.push('name');
      if (!phone) missingFields.push('phone number');

      const errorMsg = `Please fill in all required fields: ${missingFields.join(', ')}`;
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }

    const phoneRegex = /^[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 10) {
      const errorMsg = 'Please enter a valid phone number';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }

    setLoading(true);

    try {
      await setPendingReferralCode(referralCode.trim() || null);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) throw error;

      const successMsg = 'Account created! Please check your email to verify your account.';
      setSuccess(successMsg);

      Alert.alert('Success', successMsg, [{ text: 'OK', onPress: () => setMode('signin') }]);
      console.log('Sign up successful!', data);
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to sign up';
      setError(errorMsg);
      Alert.alert('Sign Up Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <View style={styles.blobTop} />
        <View style={styles.blobBottom} />

        <View style={styles.content}>
          <View style={styles.brandHeader}>
            <Text style={styles.title}>RoomPear</Text>
            <Text style={styles.tagline}>Swipe to find your next roommate</Text>
          </View>

          <View style={styles.card}>
          <Text style={styles.subtitle}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          <View style={styles.form}>
            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.placeholder}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setError(null);
                    setSuccess(null);
                  }}
                  autoCapitalize="words"
                  editable={!loading}
                />

                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={COLORS.placeholder}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    setError(null);
                    setSuccess(null);
                  }}
                  keyboardType="phone-pad"
                  editable={!loading}
                />

                <Text style={styles.label}>Friend&apos;s referral code (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. A1B2C3D4"
                  placeholderTextColor={COLORS.placeholder}
                  value={referralCode}
                  onChangeText={(text) => {
                    setReferralCode(text.toUpperCase());
                    setError(null);
                    setSuccess(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                />
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.placeholder}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
                setSuccess(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.placeholder}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
                setSuccess(null);
              }}
              secureTextEntry
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === 'signin' ? 'Continue' : 'Create account'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* GOOGLE */}
            <TouchableOpacity
              style={[styles.oauthButton, loading && styles.buttonDisabled]}
              onPress={handleGooglePlaceholder}
              disabled={loading}
            >
              <Text style={styles.oauthText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* APPLE */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.appleButton, loading && styles.buttonDisabled]}
                onPress={handleApplePlaceholder}
                disabled={loading}
              >
                <Text style={styles.appleText}>Continue with Apple</Text>
              </TouchableOpacity>
            )}

            {/* FACEBOOK */}
            <TouchableOpacity
              style={[styles.oauthButton, loading && styles.buttonDisabled]}
              onPress={handleFacebookPlaceholder}
              disabled={loading}
            >
              <Text style={styles.oauthText}>Continue with Facebook</Text>
            </TouchableOpacity>


            <TouchableOpacity
              onPress={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setEmail('');
                setPassword('');
                setName('');
                setPhone('');
                setReferralCode('');
                setError(null);
                setSuccess(null);
              }}
              disabled={loading}
              style={styles.switchWrap}
            >
              <Text style={styles.switchText}>
                {mode === 'signin'
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              By continuing, you agree to RoomPear’s Terms and Privacy Policy.
            </Text>
          </View>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },

  blobTop: {
    position: 'absolute',
    top: -140,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.teal,
    opacity: 0.14,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -170,
    left: -140,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: COLORS.green,
    opacity: 0.12,
  },

  brandHeader: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 36, fontWeight: '800', color: COLORS.ink, letterSpacing: 0.2 },
  tagline: { marginTop: 6, fontSize: 14, color: COLORS.text, opacity: 0.9 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'center',
  },

  form: { width: '100%' },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.ink,
  },

  primaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  buttonDisabled: { opacity: 0.65 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
    opacity: 0.9,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: COLORS.text,
    opacity: 0.7,
    fontWeight: '700',
  },

  oauthButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    marginTop: 10,
  },
  oauthText: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  appleButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#000000',
  },
  appleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  switchWrap: { marginTop: 14 },
  switchText: { textAlign: 'center', color: COLORS.blue, fontSize: 15, fontWeight: '700' },

  disclaimer: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.text,
    opacity: 0.75,
    textAlign: 'center',
    lineHeight: 16,
  },

  errorContainer: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  errorText: { color: COLORS.dangerText, fontSize: 14 },

  successContainer: {
    backgroundColor: COLORS.successBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  successText: { color: COLORS.successText, fontSize: 14 },
});
