/**
 * Profile Completion Screen — bio, occupation, hobbies (optional).
 * Uses shared ProfileDetailsForm; same fields as Home “Edit profile”.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { supabase } from '../lib/supabase';
import ProfileDetailsForm from '../components/ProfileDetailsForm';

interface ProfileCompletionScreenProps {
  onComplete: () => void;
}

export default function ProfileCompletionScreen({ onComplete }: ProfileCompletionScreenProps) {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [currentHobby, setCurrentHobby] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadProfileData(user.id);
      }
    });
  }, []);

  const loadProfileData = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('bio, occupation, hobbies')
        .eq('id', uid)
        .single();

      if (!error && data) {
        if (data.bio) setBio(data.bio);
        if (data.occupation) setOccupation(data.occupation);
        if (data.hobbies && Array.isArray(data.hobbies)) {
          setHobbies(data.hobbies);
        }
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  };

  const handleAddHobby = () => {
    const trimmed = currentHobby.trim();
    if (trimmed && !hobbies.includes(trimmed) && hobbies.length < 10) {
      setHobbies([...hobbies, trimmed]);
      setCurrentHobby('');
    } else if (hobbies.length >= 10) {
      Alert.alert('Maximum Hobbies', 'You can add up to 10 hobbies');
    }
  };

  const handleRemoveHobby = (hobby: string) => {
    setHobbies(hobbies.filter((h) => h !== hobby));
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);
    try {
      const updates: Record<string, unknown> = {};

      if (bio.trim()) {
        updates.bio = bio.trim();
      }

      if (occupation.trim()) {
        updates.occupation = occupation.trim();
      } else {
        updates.occupation = null;
      }

      if (hobbies.length > 0) {
        updates.hobbies = hobbies;
      } else {
        updates.hobbies = [];
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', 'Failed to save profile information');
        setLoading(false);
        return;
      }

      onComplete();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Add some details to help others get to know you better
          </Text>

          <ProfileDetailsForm
            variant="screen"
            bio={bio}
            onChangeBio={setBio}
            occupation={occupation}
            onChangeOccupation={setOccupation}
            hobbies={hobbies}
            hobbyDraft={currentHobby}
            onChangeHobbyDraft={setCurrentHobby}
            onAddHobby={handleAddHobby}
            onRemoveHobby={handleRemoveHobby}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={handleSkip}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save & Continue</Text>
              )}
            </TouchableOpacity>
          </View>
          </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D9E1E6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  content: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0C5389',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#0C5389',
    marginBottom: 32,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: '#D9E1E6',
    marginRight: 6,
  },
  skipButtonText: {
    color: '#0C5389',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#46BD7F',
    marginLeft: 6,
  },
  saveButtonText: {
    color: '#FDFDFD',
    fontSize: 16,
    fontWeight: '600',
  },
});
