/**
 * Profile photos onboarding — add 3–5 photos with live profile card preview.
 * Uses shared PublicProfileCard + lib/profilePhotos for uploads.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { pickImage, getProfileImageUrls } from '../lib/storage';
import { getPreferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import {
  uploadStagedPhotosAndMerge,
  MAX_PROFILE_PHOTOS,
  MIN_PROFILE_PHOTOS,
} from '../lib/profilePhotos';
import PublicProfileCard from '../components/PublicProfileCard';

interface ProfileCardScreenProps {
  onComplete: () => void;
}

export default function ProfileCardScreen({ onComplete }: ProfileCardScreenProps) {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedPathCount, setSavedPathCount] = useState(0);
  const [savedImageUrls, setSavedImageUrls] = useState<string[]>([]);
  const [stagingUris, setStagingUris] = useState<string[]>([]);

  const [previewName, setPreviewName] = useState('');
  const [previewAge, setPreviewAge] = useState<number | null>(null);
  const [previewLocation, setPreviewLocation] = useState('');
  const [previewBio, setPreviewBio] = useState('');
  const [previewHobbies, setPreviewHobbies] = useState<string[]>([]);

  const cardImageUrls = useMemo(
    () => [...savedImageUrls, ...stagingUris].slice(0, MAX_PROFILE_PHOTOS),
    [savedImageUrls, stagingUris]
  );

  const loadPreview = useCallback(async (uid: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, age, bio, hobbies, profile_photo_url')
      .eq('id', uid)
      .single();

    setPreviewName(profile?.name?.trim() ?? '');
    setPreviewAge(
      typeof profile?.age === 'number' && !Number.isNaN(profile.age)
        ? profile.age
        : null
    );
    setPreviewBio(profile?.bio?.trim() ?? '');
    setPreviewHobbies(Array.isArray(profile?.hobbies) ? profile.hobbies : []);

    const prefs = await getPreferences(uid);
    setPreviewLocation(formatLocationLine(prefs));

    const paths = profilePhotoPathsFromRow(profile?.profile_photo_url);
    setSavedPathCount(paths.length);
    if (paths.length > 0) {
      const signed = await getProfileImageUrls(JSON.stringify(paths));
      setSavedImageUrls(signed ?? []);
    } else {
      setSavedImageUrls([]);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadPreview(user.id);
      }
    });
  }, [loadPreview]);

  const totalSlots = savedPathCount + stagingUris.length;

  const handleAddPhoto = async () => {
    if (totalSlots >= MAX_PROFILE_PHOTOS) {
      Alert.alert('Maximum Photos', `You can add up to ${MAX_PROFILE_PHOTOS} photos`);
      return;
    }

    const photoUri = await pickImage();
    if (photoUri) {
      setStagingUris((prev) => {
        const maxNew = MAX_PROFILE_PHOTOS - savedPathCount;
        if (prev.length >= maxNew) return prev;
        return [...prev, photoUri].slice(0, maxNew);
      });
    }
  };

  const handleRemoveStaging = (index: number) => {
    setStagingUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not found');
      return;
    }

    if (savedPathCount + stagingUris.length < MIN_PROFILE_PHOTOS) {
      Alert.alert(
        'Photos Required',
        `Please add at least ${MIN_PROFILE_PHOTOS} photos (up to ${MAX_PROFILE_PHOTOS})`
      );
      return;
    }

    if (stagingUris.length === 0) {
      onComplete();
      return;
    }

    setLoading(true);
    try {
      const result = await uploadStagedPhotosAndMerge(userId, stagingUris);
      if (!result.ok) {
        Alert.alert('Error', result.error ?? 'Failed to save photos');
        setLoading(false);
        return;
      }
      onComplete();
    } catch (error: any) {
      console.error('Error saving photos:', error);
      Alert.alert('Error', error.message || 'Failed to save photos');
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
          <Text style={styles.title}>Your profile card</Text>
          <Text style={styles.subtitle}>
            Add 3–5 photos. This preview updates as you go — same card others see on your profile.
          </Text>

          <PublicProfileCard
            imageUrls={cardImageUrls}
            name={previewName}
            age={previewAge}
            location={previewLocation}
            bio={previewBio}
            hobbies={previewHobbies}
          />

          <View style={styles.section}>
            <Text style={styles.label}>Profile photos ({MIN_PROFILE_PHOTOS}–{MAX_PROFILE_PHOTOS})</Text>

            <View style={styles.photoGrid}>
              {stagingUris.map((uri, index) => (
                <View key={`s-${index}`} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => handleRemoveStaging(index)}
                  >
                    <Text style={styles.removePhotoText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {stagingUris.length + savedPathCount < MAX_PROFILE_PHOTOS ? (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handleAddPhoto}
                >
                  <Text style={styles.addPhotoText}>+</Text>
                  <Text style={styles.addPhotoLabel}>Add Photo</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {totalSlots < MIN_PROFILE_PHOTOS ? (
              <Text style={styles.errorText}>
                Add at least {MIN_PROFILE_PHOTOS} photos ({totalSlots}/{MIN_PROFILE_PHOTOS})
              </Text>
            ) : null}

            <Text style={styles.hint}>
              First photo is your cover; order is saved top-to-bottom, left-to-right.
            </Text>
          </View>

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
              disabled={loading || savedPathCount + stagingUris.length < MIN_PROFILE_PHOTOS}
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
    backgroundColor: '#D9E1E6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 56,
  },
  content: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0C5389',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#0C5389',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginTop: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  photoContainer: {
    width: '30%',
    aspectRatio: 1,
    position: 'relative',
    marginBottom: 12,
    marginHorizontal: '1.5%',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#D9E1E6',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FDFDFD',
  },
  removePhotoText: {
    color: '#FDFDFD',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  addPhotoButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D9E1E6',
    borderStyle: 'dashed',
    backgroundColor: '#FDFDFD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: '1.5%',
  },
  addPhotoText: {
    fontSize: 32,
    color: '#189AA2',
    fontWeight: '300',
    marginBottom: 4,
  },
  addPhotoLabel: {
    fontSize: 12,
    color: '#0C5389',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#189AA2',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  skipButton: {
    backgroundColor: '#D9E1E6',
  },
  skipButtonText: {
    color: '#0C5389',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#46BD7F',
  },
  saveButtonText: {
    color: '#FDFDFD',
    fontSize: 16,
    fontWeight: '600',
  },
});
