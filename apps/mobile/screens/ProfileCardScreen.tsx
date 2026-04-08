/**
 * Profile Card Screen
 * Screen for uploading 3-5 photos for the user's profile card
 * Appears after profile completion
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { pickImage, uploadProfileImage, getProfileImageUrls } from '../lib/storage';
import { getPreferences } from '../lib/preferences';
import { formatLocationLine } from '../lib/profileDisplay';
import PublicProfileCard from '../components/PublicProfileCard';

interface ProfileCardScreenProps {
  onComplete: () => void;
}

export default function ProfileCardScreen({ onComplete }: ProfileCardScreenProps) {
  const [phase, setPhase] = useState<'upload' | 'preview'>('upload');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profilePhotos, setProfilePhotos] = useState<string[]>([]); // Array of local URIs
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewName, setPreviewName] = useState('');
  const [previewAge, setPreviewAge] = useState<number | null>(null);
  const [previewLocation, setPreviewLocation] = useState('');
  const [previewBio, setPreviewBio] = useState('');
  const [previewHobbies, setPreviewHobbies] = useState<string[]>([]);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        // Load existing photos if any
        loadExistingPhotos(user.id);
      }
    });
  }, []);

  const loadExistingPhotos = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_photo_url')
        .eq('id', userId)
        .single();

      if (!error && data?.profile_photo_url) {
        try {
          const parsed = JSON.parse(data.profile_photo_url);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Photos already exist, user can skip or add more
            // For now, we'll let them add new photos
          }
        } catch {
          // Not JSON, might be single photo - ignore for now
        }
      }
    } catch (error) {
      console.error('Error loading existing photos:', error);
    }
  };

  const handleAddPhoto = async () => {
    if (profilePhotos.length >= 5) {
      Alert.alert('Maximum Photos', 'You can add up to 5 photos');
      return;
    }

    const photoUri = await pickImage();
    if (photoUri) {
      setProfilePhotos([...profilePhotos, photoUri]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = profilePhotos.filter((_, i) => i !== index);
    setProfilePhotos(newPhotos);
  };

  const handleUploadPhotos = async () => {
    if (!userId || profilePhotos.length === 0) return [];

    setUploadingPhotos(true);
    try {
      const uploadedPaths: string[] = [];

      // Upload each photo
      for (const photoUri of profilePhotos) {
        const { path, error } = await uploadProfileImage(userId, photoUri);
        if (error || !path) {
          console.error('Error uploading photo:', error);
          Alert.alert('Upload Error', `Failed to upload one or more photos: ${error}`);
          continue;
        }
        uploadedPaths.push(path);
      }

      setUploadingPhotos(false);
      return uploadedPaths;
    } catch (error: any) {
      console.error('Error uploading photos:', error);
      setUploadingPhotos(false);
      Alert.alert('Error', error.message || 'Failed to upload photos');
      return [];
    }
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not found');
      return;
    }

    // Validate minimum photos requirement
    if (profilePhotos.length < 3) {
      Alert.alert('Photos Required', 'Please add at least 3 photos (up to 5)');
      return;
    }

    setLoading(true);
    try {
      // Upload photos first
      const uploadedPaths = await handleUploadPhotos();
      
      if (uploadedPaths.length === 0 && profilePhotos.length > 0) {
        Alert.alert('Error', 'Failed to upload photos. Please try again.');
        setLoading(false);
        return;
      }

      // Get existing photos if any (from onboarding)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('profile_photo_url')
        .eq('id', userId)
        .single();

      let existingPhotos: string[] = [];
      if (existingProfile?.profile_photo_url) {
        try {
          const parsed = JSON.parse(existingProfile.profile_photo_url);
          if (Array.isArray(parsed)) {
            existingPhotos = parsed;
          }
        } catch {
          // Not JSON, might be single photo - convert to array
          existingPhotos = [existingProfile.profile_photo_url];
        }
      }

      // Combine existing and new photos, limit to 5 total
      const allPhotos = [...existingPhotos, ...uploadedPaths].slice(0, 5);
      
      const { error } = await supabase
        .from('profiles')
        .update({ profile_photo_url: JSON.stringify(allPhotos) })
        .eq('id', userId);

      if (error) {
        console.error('Error updating profile photos:', error);
        Alert.alert('Error', 'Failed to save photos');
        setLoading(false);
        return;
      }

      const signedUrls = await getProfileImageUrls(JSON.stringify(allPhotos));
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('name, age, bio, hobbies')
        .eq('id', userId)
        .single();
      const prefs = await getPreferences(userId);

      setPreviewUrls(signedUrls ?? []);
      setPreviewName(profileRow?.name?.trim() || '');
      setPreviewAge(
        typeof profileRow?.age === 'number' && !Number.isNaN(profileRow.age)
          ? profileRow.age
          : null
      );
      setPreviewLocation(formatLocationLine(prefs));
      setPreviewBio(profileRow?.bio?.trim() ?? '');
      setPreviewHobbies(
        Array.isArray(profileRow?.hobbies) ? profileRow.hobbies : []
      );
      setPhase('preview');
    } catch (error: any) {
      console.error('Error saving photos:', error);
      Alert.alert('Error', error.message || 'Failed to save photos');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow skipping if they already have photos from onboarding
    onComplete();
  };

  const handlePreviewContinue = () => {
    onComplete();
  };

  if (phase === 'preview') {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Your profile card</Text>
            <Text style={styles.subtitle}>
              This is how other people see you. Swipe the photos to browse.
            </Text>

            <PublicProfileCard
              imageUrls={previewUrls}
              name={previewName}
              age={previewAge}
              location={previewLocation}
              bio={previewBio}
              hobbies={previewHobbies}
            />

            <TouchableOpacity
              style={styles.previewContinueButton}
              onPress={handlePreviewContinue}
            >
              <Text style={styles.saveButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Add Your Profile Photos</Text>
          <Text style={styles.subtitle}>
            Add 3-5 photos, then preview how your card looks to others
          </Text>

          {/* Photos Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Profile Photos (3-5 photos)</Text>
            
            {/* Photo grid */}
            <View style={styles.photoGrid}>
              {profilePhotos.map((uri, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Text style={styles.removePhotoText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* Add photo button */}
              {profilePhotos.length < 5 && (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handleAddPhoto}
                  disabled={uploadingPhotos}
                >
                  <Text style={styles.addPhotoText}>+</Text>
                  <Text style={styles.addPhotoLabel}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {profilePhotos.length < 3 && (
              <Text style={styles.errorText}>
                Please add at least 3 photos ({profilePhotos.length}/3)
              </Text>
            )}

            {uploadingPhotos && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#189AA2" />
                <Text style={styles.uploadingText}>Uploading photos...</Text>
              </View>
            )}

            <Text style={styles.hint}>
              These photos will be visible on your profile card
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={handleSkip}
              disabled={loading || uploadingPhotos}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={loading || uploadingPhotos || profilePhotos.length < 3}
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    justifyContent: 'center',
  },
  photoContainer: {
    width: '30%',
    aspectRatio: 1,
    position: 'relative',
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#D9E1E6', // Light Cool Gray
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B6B', // Red
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FDFDFD', // Pure White
  },
  removePhotoText: {
    color: '#FDFDFD', // Pure White
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  addPhotoButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D9E1E6', // Light Cool Gray
    borderStyle: 'dashed',
    backgroundColor: '#FDFDFD', // Pure White
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  addPhotoText: {
    fontSize: 32,
    color: '#189AA2', // Teal / Blue-Green
    fontWeight: '300',
    marginBottom: 4,
  },
  addPhotoLabel: {
    fontSize: 12,
    color: '#0C5389', // Deep Blue
    fontWeight: '500',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#189AA2', // Teal / Blue-Green
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B', // Red for errors
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
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
  previewContinueButton: {
    marginTop: 28,
    marginBottom: 40,
    width: '100%',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#46BD7F',
  },
});
