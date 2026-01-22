/**
 * Profile Completion Screen
 * Appears after onboarding to collect additional profile information
 * such as bio, hobbies, and other details for the profile card
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface ProfileCompletionScreenProps {
  onComplete: () => void;
}

export default function ProfileCompletionScreen({ onComplete }: ProfileCompletionScreenProps) {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Profile fields
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [currentHobby, setCurrentHobby] = useState('');

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        // Load existing profile data if any
        loadProfileData(user.id);
      }
    });
  }, []);

  const loadProfileData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('bio, occupation, hobbies')
        .eq('id', userId)
        .single();

      if (!error && data) {
        if (data.bio) setBio(data.bio);
        if (data.occupation) setOccupation(data.occupation);
        // Load hobbies from the hobbies column (TEXT[] array)
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
    setHobbies(hobbies.filter(h => h !== hobby));
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);
    try {
      const updates: any = {};
      
      if (bio.trim()) {
        updates.bio = bio.trim();
      }

      // Save occupation
      if (occupation.trim()) {
        updates.occupation = occupation.trim();
      } else {
        // Allow clearing occupation
        updates.occupation = null;
      }

      // Save hobbies as TEXT[] array
      if (hobbies.length > 0) {
        updates.hobbies = hobbies;
      } else {
        // Allow clearing hobbies
        updates.hobbies = [];
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

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
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Add some details to help others get to know you better
          </Text>

          {/* Bio Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Bio (optional)</Text>
            <TextInput
              style={styles.bioInput}
              placeholder="Tell us about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </View>

          {/* Occupation Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Occupation (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="What do you do?"
              value={occupation}
              onChangeText={setOccupation}
              maxLength={100}
            />
          </View>

          {/* Hobbies Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Hobbies & Interests (optional)</Text>
            <View style={styles.hobbyInputContainer}>
              <TextInput
                style={styles.hobbyInput}
                placeholder="Add a hobby or interest"
                value={currentHobby}
                onChangeText={setCurrentHobby}
                onSubmitEditing={handleAddHobby}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddHobby}
                disabled={!currentHobby.trim() || hobbies.length >= 10}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            
            {hobbies.length > 0 && (
              <View style={styles.hobbiesContainer}>
                {hobbies.map((hobby, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.hobbyTag}
                    onPress={() => handleRemoveHobby(hobby)}
                  >
                    <Text style={styles.hobbyText}>{hobby}</Text>
                    <Text style={styles.removeHobbyText}>×</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            <Text style={styles.hint}>
              Add up to 10 hobbies or interests
            </Text>
          </View>

          {/* Action Buttons */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D9E1E6', // Light Cool Gray
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
    color: '#0C5389', // Deep Blue
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#0C5389', // Deep Blue
    marginBottom: 32,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C5389', // Deep Blue
    marginBottom: 12,
  },
  bioInput: {
    backgroundColor: '#FDFDFD', // Pure White
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#0C5389', // Deep Blue
    borderWidth: 1,
    borderColor: '#D9E1E6', // Light Cool Gray
    minHeight: 100,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#189AA2', // Teal / Blue-Green
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#FDFDFD', // Pure White
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#0C5389', // Deep Blue
    borderWidth: 1,
    borderColor: '#D9E1E6', // Light Cool Gray
  },
  hobbyInputContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  hobbyInput: {
    flex: 1,
    backgroundColor: '#FDFDFD', // Pure White
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#0C5389', // Deep Blue
    borderWidth: 1,
    borderColor: '#D9E1E6', // Light Cool Gray
  },
  addButton: {
    backgroundColor: '#189AA2', // Teal / Blue-Green
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FDFDFD', // Pure White
    fontSize: 16,
    fontWeight: '600',
  },
  hobbiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  hobbyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#189AA2', // Teal / Blue-Green
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  hobbyText: {
    color: '#FDFDFD', // Pure White
    fontSize: 14,
    fontWeight: '500',
  },
  removeHobbyText: {
    color: '#FDFDFD', // Pure White
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  hint: {
    fontSize: 14,
    color: '#189AA2', // Teal / Blue-Green
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: '#D9E1E6', // Light Cool Gray
  },
  skipButtonText: {
    color: '#0C5389', // Deep Blue
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#46BD7F', // Primary Green
  },
  saveButtonText: {
    color: '#FDFDFD', // Pure White
    fontSize: 16,
    fontWeight: '600',
  },
});

