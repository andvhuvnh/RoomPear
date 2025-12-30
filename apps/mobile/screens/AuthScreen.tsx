import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      const errorMsg = 'Please fill in all fields';
      setError(errorMsg);
      console.error('Validation error:', errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }

    setLoading(true);
    console.log('Attempting sign in with email:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Sign in response:', { data, error });

      if (error) {
        console.error('Sign in error:', error);
        throw error;
      }

      console.log('Sign in successful!', data);
      setSuccess('Signed in successfully!');
      // Success - auth state will update automatically
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to sign in';
      console.error('Sign in catch error:', error);
      setError(errorMsg);
      Alert.alert('Sign In Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    setSuccess(null);

    // Validate required fields
    if (!email || !password || !name || !phone) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!password) missingFields.push('password');
      if (!name) missingFields.push('name');
      if (!phone) missingFields.push('phone number');
      
      const errorMsg = `Please fill in all required fields: ${missingFields.join(', ')}`;
      setError(errorMsg);
      console.error('Validation error:', errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }

    // Basic phone validation (digits, spaces, dashes, parentheses)
    const phoneRegex = /^[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 10) {
      const errorMsg = 'Please enter a valid phone number';
      setError(errorMsg);
      console.error('Validation error:', errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }

    setLoading(true);
    console.log('Attempting sign up with email:', email);
    
    try {
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

      console.log('Sign up response:', { data, error });

      if (error) {
        console.error('Sign up error:', error);
        throw error;
      }

      const successMsg = 'Account created! Please check your email to verify your account.';
      console.log('Sign up successful!', data);
      setSuccess(successMsg);
      Alert.alert(
        'Success',
        successMsg,
        [{ text: 'OK', onPress: () => setMode('signin') }]
      );
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to sign up';
      console.error('Sign up catch error:', error);
      setError(errorMsg);
      Alert.alert('Sign Up Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RoomPear</Text>
      <Text style={styles.subtitle}>
        {mode === 'signin' ? 'Sign In' : 'Create Account'}
      </Text>

      <View style={styles.form}>
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

        {mode === 'signup' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Name *"
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
                setSuccess(null);
              }}
              autoCapitalize="words"
              editable={!loading}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone Number *"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setError(null);
                setSuccess(null);
              }}
              keyboardType="phone-pad"
              editable={!loading}
            />
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
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

        <TextInput
          style={styles.input}
          placeholder="Password"
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
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={mode === 'signin' ? handleSignIn : handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setEmail('');
            setPassword('');
            setName('');
            setPhone('');
          }}
          disabled={loading}
        >
          <Text style={styles.switchText}>
            {mode === 'signin'
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Sign In'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  switchText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#007AFF',
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  successText: {
    color: '#2E7D32',
    fontSize: 14,
  },
});

