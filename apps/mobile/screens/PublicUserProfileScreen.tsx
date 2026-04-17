import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatsStackParamList } from '../navigation/ChatsStack';
import type { LikesStackParamList } from '../navigation/LikesStack';
import { supabase } from '../lib/supabase';
import { getProfileImageUrls } from '../lib/storage';
import { getPreferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import PublicProfileCard from '../components/PublicProfileCard';

// Works for both ChatsStack and LikesStack since they share the same param shape
type Props =
  | NativeStackScreenProps<ChatsStackParamList, 'ProfileView'>
  | NativeStackScreenProps<LikesStackParamList, 'ProfileView'>;

export default function PublicUserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params as { userId: string; name: string };

  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [name, setName] = useState(route.params.name ?? '');
  const [age, setAge] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState<string | null>(null);
  const [hobbies, setHobbies] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, age, bio, hobbies, profile_photo_url')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      if (profile) {
        setName(profile.name ?? name);
        setAge(typeof profile.age === 'number' ? profile.age : null);
        setBio(profile.bio ?? null);
        setHobbies(Array.isArray(profile.hobbies) ? profile.hobbies : []);

        const paths = profilePhotoPathsFromRow(profile.profile_photo_url);
        if (paths.length > 0) {
          const urls = await getProfileImageUrls(profile.profile_photo_url);
          if (!cancelled) setImageUrls(urls ?? []);
        }
      }

      const prefs = await getPreferences(userId);
      if (!cancelled) setLocation(formatLocationLine(prefs));

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{name}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0C5389" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <PublicProfileCard
            imageUrls={imageUrls}
            name={name}
            age={age}
            location={location}
            bio={bio}
            hobbies={hobbies}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF2',
    backgroundColor: '#FDFDFD',
  },
  backBtn: {
    width: 60,
  },
  backText: {
    fontSize: 17,
    color: '#0C5389',
    fontWeight: '600',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#0C5389',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
});
