import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        // Fetch profile
        fetchProfile(user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else {
      setProfile(data);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to RoomPear!</Text>
      
      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{user.email}</Text>
          
          {profile && (
            <>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{profile.name || 'Not set'}</Text>
              
              <Text style={styles.label}>Subscription:</Text>
              <Text style={styles.value}>{profile.subscription_tier || 'free'}</Text>
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFDFD', // Pure White
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#0C5389', // Deep Blue
  },
  userInfo: {
    backgroundColor: '#D9E1E6', // Light Cool Gray
    borderRadius: 8,
    padding: 20,
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    color: '#0C5389', // Deep Blue
    marginTop: 10,
    marginBottom: 5,
  },
  value: {
    fontSize: 18,
    color: '#0C5389', // Deep Blue
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#189AA2', // Teal / Blue-Green
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FDFDFD', // Pure White
    fontSize: 18,
    fontWeight: '600',
  },
});

