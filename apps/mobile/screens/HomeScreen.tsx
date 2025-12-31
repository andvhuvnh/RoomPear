import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import { pickImage, uploadAndUpdateProfileImage, getProfileImageUrl } from '../lib/storage';

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

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
      console.log('Profile fetched:', data);
      console.log('Profile photo path:', data?.profile_photo_url);
      setProfile(data);
      // Reset image error when profile is fetched
      setImageError(false);
      
      // Generate signed URL for the profile image if it exists
      if (data?.profile_photo_url) {
        const signedUrl = await getProfileImageUrl(data.profile_photo_url);
        setImageUrl(signedUrl);
        console.log('Generated signed URL for profile image');
      } else {
        setImageUrl(null);
      }
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUpdateProfileImage = async () => {
    if (!user) return;

    const imageUri = await pickImage();
    if (!imageUri) return;

    // Show loading state (you could use a loading indicator here)
    console.log('Starting image upload...');
    
    const { path, error } = await uploadAndUpdateProfileImage(user.id, imageUri);
    
    if (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', error);
    } else if (path) {
      console.log('✅ Upload successful, path:', path);
      
      // Reset image error state
      setImageError(false);
      // Update local state immediately with the new path
      setProfile((prev: any) => {
        const updated = { ...prev, profile_photo_url: path };
        console.log('Updated profile state:', updated);
        return updated;
      });
      // Generate signed URL for the new image
      if (path) {
        const signedUrl = await getProfileImageUrl(path);
        setImageUrl(signedUrl);
      }
      // Also refresh from server to ensure consistency
      await fetchProfile(user.id);
      Alert.alert('Success', 'Profile picture updated!');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to RoomPear!</Text>
      
      {user && (
        <View style={styles.userInfo}>
          {/* Profile Image */}
          <View style={styles.profileImageContainer}>
            {profile?.profile_photo_url ? (
              <>
                {!imageError && imageUrl ? (
                  <Image
                    key={`img-${imageUrl}`} // Force re-render when URL changes
                    source={{ uri: imageUrl }}
                    style={styles.profileImage}
                    resizeMode="cover"
                    onError={(error) => {
                      console.error('❌ Error loading profile image');
                      console.error('Error details:', error.nativeEvent?.error || error);
                      console.error('Failed URL:', imageUrl);
                      setImageError(true);
                    }}
                    onLoad={() => {
                      console.log('✅ Profile image loaded successfully');
                      console.log('Image URL:', imageUrl);
                      setImageError(false);
                    }}
                    onLoadStart={() => {
                      console.log('🔄 Starting to load image');
                      console.log('URL:', imageUrl);
                    }}
                    onLoadEnd={() => {
                      console.log('🔄 Image load ended');
                    }}
                  />
                ) : (
                  <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                    <Text style={styles.profileImageText}>
                      {profile?.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </Text>
                    {__DEV__ && (
                      <Text style={styles.debugText} numberOfLines={1}>
                        Load error
                      </Text>
                    )}
                  </View>
                )}
                {/* Debug: Show URL in dev mode */}
                {__DEV__ && (
                  <Text style={styles.debugText} numberOfLines={2}>
                    {profile.profile_photo_url}
                  </Text>
                )}
              </>
            ) : (
              <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                <Text style={styles.profileImageText}>
                  {profile?.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                </Text>
                {__DEV__ && (
                  <Text style={styles.debugText}>
                    No URL set
                  </Text>
                )}
              </View>
            )}
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={handleUpdateProfileImage}
            >
              <Text style={styles.changePhotoButtonText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

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
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#189AA2', // Teal / Blue-Green
  },
  profileImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FDFDFD', // Pure White
  },
  changePhotoButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#189AA2', // Teal / Blue-Green
    borderRadius: 6,
  },
  changePhotoButtonText: {
    color: '#FDFDFD', // Pure White
    fontSize: 14,
    fontWeight: '600',
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
  debugText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});

