import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { getProfileImageUrls, pickImage } from '../lib/storage';
import { getPreferences, type Preferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import { appendProfilePhoto, removeProfilePhotoAt, MAX_PROFILE_PHOTOS } from '../lib/profilePhotos';
import PublicProfileCard from '../components/PublicProfileCard';
import ProfileDetailsForm from '../components/ProfileDetailsForm';

export default function ProfileScreen() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editPhotosOpen, setEditPhotosOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);

  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editHobbies, setEditHobbies] = useState<string[]>([]);
  const [editHobbyDraft, setEditHobbyDraft] = useState('');

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    setProfile(data);

    const paths = profilePhotoPathsFromRow(data?.profile_photo_url);
    setPhotoPaths(paths);

    if (data?.profile_photo_url) {
      const signedUrls = await getProfileImageUrls(data.profile_photo_url);
      setImageUrls(signedUrls ?? []);
    } else {
      setImageUrls([]);
    }

    const p = await getPreferences(userId);
    setPrefs(p);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ? { id: u.id, email: u.email } : null);
      if (u) loadProfile(u.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email } : null);
      if (u) loadProfile(u.id);
      else {
        setProfile(null);
        setPrefs(null);
        setImageUrls([]);
        setPhotoPaths([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const openEditProfile = () => {
    if (!profile) return;
    setEditName(profile.name?.trim() ?? '');
    setEditBio(profile.bio?.trim() ?? '');
    setEditOccupation(profile.occupation?.trim() ?? '');
    setEditHobbies(Array.isArray(profile.hobbies) ? [...profile.hobbies] : []);
    setEditHobbyDraft('');
    setEditProfileOpen(true);
  };

  const handleAddEditHobby = () => {
    const t = editHobbyDraft.trim();
    if (!t || editHobbies.includes(t) || editHobbies.length >= 10) return;
    setEditHobbies([...editHobbies, t]);
    setEditHobbyDraft('');
  };

  const handleRemoveEditHobby = (h: string) => {
    setEditHobbies(editHobbies.filter((x) => x !== h));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName.trim() || profile?.name,
          bio: editBio.trim() || null,
          occupation: editOccupation.trim() || null,
          hobbies: editHobbies,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setEditProfileOpen(false);
      await loadProfile(user.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!user) return;
    if (photoPaths.length >= MAX_PROFILE_PHOTOS) {
      Alert.alert('Photos', `You can have up to ${MAX_PROFILE_PHOTOS} photos.`);
      return;
    }
    const uri = await pickImage();
    if (!uri) return;

    setSavingPhotos(true);
    try {
      const result = await appendProfilePhoto(user.id, uri);
      if (!result.ok) {
        Alert.alert('Upload failed', result.error ?? 'Unknown error');
        return;
      }
      await loadProfile(user.id);
    } finally {
      setSavingPhotos(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (!user) return;

    Alert.alert('Remove photo', 'Remove this photo from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSavingPhotos(true);
          try {
            const result = await removeProfilePhotoAt(user.id, index);
            if (!result.ok) {
              Alert.alert('Cannot remove', result.error ?? 'Error');
              return;
            }
            await loadProfile(user.id);
          } finally {
            setSavingPhotos(false);
          }
        },
      },
    ]);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  const displayName = profile?.name?.trim() || '';
  const displayAge =
    typeof profile?.age === 'number' && !Number.isNaN(profile.age)
      ? profile.age
      : null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.tagline}>How you appear to others</Text>

        {user && (
          <>
            <PublicProfileCard
              imageUrls={imageUrls}
              name={displayName}
              age={displayAge}
              location={formatLocationLine(prefs)}
              bio={profile?.bio ?? ''}
              hobbies={Array.isArray(profile?.hobbies) ? profile.hobbies : []}
            />

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={openEditProfile}>
                <Text style={styles.primaryButtonText}>Edit profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setEditPhotosOpen(true)}
              >
                <Text style={styles.secondaryButtonText}>Edit photos</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.accountCard}>
              <Text style={styles.accountTitle}>Account</Text>
              {user.email ? (
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Email</Text>
                  <Text style={styles.accountValue}>{user.email}</Text>
                </View>
              ) : null}
              {profile?.phone ? (
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Phone</Text>
                  <Text style={styles.accountValue}>{profile.phone}</Text>
                </View>
              ) : null}
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Plan</Text>
                <Text style={styles.accountValue}>
                  {(profile?.subscription_tier as string) || 'free'}
                </Text>
              </View>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutButtonText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={editProfileOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditProfileOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditProfileOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? (
                <ActivityIndicator color="#189AA2" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <ProfileDetailsForm
              variant="modal"
              showName
              name={editName}
              onChangeName={setEditName}
              bio={editBio}
              onChangeBio={setEditBio}
              occupation={editOccupation}
              onChangeOccupation={setEditOccupation}
              hobbies={editHobbies}
              hobbyDraft={editHobbyDraft}
              onChangeHobbyDraft={setEditHobbyDraft}
              onAddHobby={handleAddEditHobby}
              onRemoveHobby={handleRemoveEditHobby}
              footerHint="Location comes from your housing preferences (onboarding)."
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editPhotosOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditPhotosOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditPhotosOpen(false)}>
              <Text style={styles.modalCancel}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Photos</Text>
            <View style={{ width: 48 }} />
          </View>
          <ScrollView contentContainerStyle={styles.photosModalContent}>
            <Text style={styles.photosHelp}>
              First photo is your cover. Swipe on your profile card to see the rest. Keep 3–5 photos.
            </Text>
            {savingPhotos ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#189AA2" />
            ) : null}
            <View style={styles.photoList}>
              {imageUrls.map((url, index) => (
                <View key={url + index} style={styles.photoRow}>
                  <Image source={{ uri: url }} style={styles.photoRowImage} />
                  <View style={styles.photoRowMeta}>
                    <Text style={styles.photoRowLabel}>
                      {index === 0 ? 'Cover photo' : `Photo ${index + 1}`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(index)}
                      disabled={savingPhotos}
                    >
                      <Text style={styles.photoRemoveLink}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.addPhotoBtn,
                photoPaths.length >= MAX_PROFILE_PHOTOS && styles.addPhotoBtnDisabled,
              ]}
              onPress={handleAddPhoto}
              disabled={savingPhotos || photoPaths.length >= MAX_PROFILE_PHOTOS}
            >
              <Text style={styles.addPhotoBtnText}>
                {photoPaths.length >= MAX_PROFILE_PHOTOS
                  ? `Maximum ${MAX_PROFILE_PHOTOS} photos`
                  : '+ Add photo'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8EEF2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0C5389',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    color: '#189AA2',
    marginBottom: 20,
  },
  actionRow: {
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: '#46BD7F',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FDFDFD',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FDFDFD',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#189AA2',
  },
  secondaryButtonText: {
    color: '#0C5389',
    fontSize: 16,
    fontWeight: '600',
  },
  accountCard: {
    marginTop: 28,
    backgroundColor: '#FDFDFD',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  accountTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 14,
  },
  accountRow: {
    marginBottom: 12,
  },
  accountLabel: {
    fontSize: 12,
    color: '#189AA2',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  accountValue: {
    fontSize: 16,
    color: '#0C5389',
  },
  signOutButton: {
    marginTop: 16,
    backgroundColor: '#D9E1E6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#0C5389',
    fontSize: 16,
    fontWeight: '600',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#FDFDFD',
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9E1E6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0C5389',
  },
  modalCancel: {
    fontSize: 17,
    color: '#189AA2',
    width: 72,
  },
  modalSave: {
    fontSize: 17,
    fontWeight: '600',
    color: '#46BD7F',
    width: 72,
    textAlign: 'right',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  photosModalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  photosHelp: {
    fontSize: 14,
    color: '#0C5389',
    marginBottom: 16,
    lineHeight: 20,
  },
  photoList: {
    width: '100%',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F5F8FA',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  photoRowImage: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#D9E1E6',
  },
  photoRowMeta: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  photoRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 6,
  },
  photoRemoveLink: {
    fontSize: 15,
    color: '#E85D4C',
    fontWeight: '600',
  },
  addPhotoBtn: {
    marginTop: 20,
    backgroundColor: '#46BD7F',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addPhotoBtnDisabled: {
    opacity: 0.5,
  },
  addPhotoBtnText: {
    color: '#FDFDFD',
    fontSize: 16,
    fontWeight: '600',
  },
});
