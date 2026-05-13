import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatsStackParamList } from '../navigation/ChatsStack';
import type { LikesStackParamList } from '../navigation/LikesStack';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import { supabase } from '../lib/supabase';
import { getProfileImageUrls } from '../lib/storage';
import { getPreferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import SwipeCard from '../components/SwipeCard';
import type { DiscoverProfile } from '../lib/discover';
import { ChatStyleTopBar } from '../components/ChatStyleTopBar';
import BlockReportModal from '../components/BlockReportModal';
import PearLoader from '../components/PearLoader';
import PeerSafetyActionsModal, { type PeerSafetyStart } from '../components/PeerSafetyActionsModal';

type PromptEntry = { question: string; answer: string };

function normalizePrompts(raw: unknown): PromptEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptEntry[] = [];
  for (const p of raw) {
    if (
      p != null &&
      typeof p === 'object' &&
      typeof (p as PromptEntry).question === 'string' &&
      typeof (p as PromptEntry).answer === 'string'
    ) {
      out.push({ question: (p as PromptEntry).question, answer: (p as PromptEntry).answer });
    }
  }
  return out.slice(0, 6);
}

type Props =
  | NativeStackScreenProps<ChatsStackParamList, 'ProfileView'>
  | NativeStackScreenProps<LikesStackParamList, 'ProfileView'>;

export default function PublicUserProfileScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { userId, conversationId, profileSource = 'chats' } = route.params as {
    userId: string;
    name: string;
    conversationId?: string;
    profileSource?: 'chats' | 'likes';
  };
  const initialName = route.params.name ?? '';

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState<number | null>(null);
  const [occupation, setOccupation] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [interests, setInterests] = useState<Record<string, string[]>>({});
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [listingPhotoUrls, setListingPhotoUrls] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [hasListing, setHasListing] = useState(false);
  const [listingRent, setListingRent] = useState<number | null>(null);
  const [listingRoomType, setListingRoomType] = useState<string | null>(null);
  const [roomType, setRoomType] = useState<string | null>(null);
  const [minBudget, setMinBudget] = useState<number | null>(null);
  const [maxBudget, setMaxBudget] = useState<number | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [peerSafetyOpen, setPeerSafetyOpen] = useState(false);
  const [peerSafetyStart, setPeerSafetyStart] = useState<PeerSafetyStart>('main');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setMyUserId(user.id);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const [profileRes, listingRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('name, age, bio, hobbies, profile_photo_url, prompts, occupation')
          .eq('id', userId)
          .single(),
        supabase
          .from('listings')
          .select('rent, room_type, listing_photos')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const profile = profileRes.data;
      if (profile) {
        setName(profile.name ?? initialName);
        setAge(typeof profile.age === 'number' ? profile.age : null);
        setOccupation(profile.occupation ?? null);
        setBio(profile.bio ?? null);
        setHobbies(Array.isArray(profile.hobbies) ? profile.hobbies : []);
        setPrompts(normalizePrompts(profile.prompts));

        const paths = profilePhotoPathsFromRow(profile.profile_photo_url);
        if (paths.length > 0) {
          const urls = await getProfileImageUrls(profile.profile_photo_url);
          if (!cancelled) setImageUrls(urls ?? []);
        } else if (!cancelled) {
          setImageUrls([]);
        }
      }

      const listing = listingRes.data;
      if (listing) {
        setHasListing(true);
        setListingRent(listing.rent ?? null);
        setListingRoomType(listing.room_type ?? null);
        if (listing.listing_photos) {
          const listingUrls = await getProfileImageUrls(listing.listing_photos);
          if (!cancelled) setListingPhotoUrls(listingUrls ?? []);
        }
      }

      const prefs = await getPreferences(userId);
      if (cancelled) return;

      setLocation(formatLocationLine(prefs));
      setInterests((prefs?.interests as Record<string, string[]>) ?? {});
      setRoomType(prefs?.room_type ?? null);
      setMinBudget(prefs?.min_budget ?? null);
      setMaxBudget(prefs?.max_budget ?? null);

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId, initialName]);

  const discoverProfile = useMemo<DiscoverProfile>(() => ({
    id: userId,
    name,
    age,
    occupation,
    bio,
    hobbies: hobbies.length > 0 ? hobbies : null,
    interests,
    prompts,
    photoUrls: [...imageUrls, ...listingPhotoUrls],
    profilePhotoCount: imageUrls.length,
    location,
    hasListing,
    roomType,
    listingRoomType,
    listingRent,
    minBudget,
    maxBudget,
    compatibilityScore: 0,
    matchReasons: [],
  }), [userId, name, age, occupation, bio, hobbies, interests, prompts, imageUrls, listingPhotoUrls, location, hasListing, roomType, listingRoomType, listingRent, minBudget, maxBudget]);

  const openChat = useCallback(() => {
    const title = name || initialName || 'Chat';
    const params = conversationId
      ? { conversationId, otherUserId: userId, title }
      : { otherUserId: userId, title };

    if (profileSource === 'likes') {
      const tabNav = navigation.getParent() as BottomTabNavigationProp<MainTabParamList> | undefined;
      tabNav?.navigate('Chats', { screen: 'Chat', params });
      return;
    }

    (navigation as NativeStackNavigationProp<ChatsStackParamList>).navigate('Chat', params);
  }, [conversationId, initialName, name, navigation, profileSource, userId]);

  const openSafetyMenu = useCallback(() => {
    if (profileSource !== 'chats') return;
    setPeerSafetyStart('main');
    setPeerSafetyOpen(true);
  }, [profileSource]);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.centered}>
          <PearLoader size={64} />
        </View>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <ChatStyleTopBar
            title=""
            onBack={() => navigation.goBack()}
            topInset={insets.top}
            onMenu={profileSource === 'chats' ? openSafetyMenu : undefined}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SwipeCard
        profile={discoverProfile}
        style={styles.card}
        scrollPaddingTop={insets.top + 64}
        onReport={profileSource === 'chats' ? () => {
          setPeerSafetyStart('report');
          setPeerSafetyOpen(true);
        } : undefined}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <ChatStyleTopBar
          title=""
          onBack={() => navigation.goBack()}
          topInset={insets.top}
          onMenu={profileSource === 'chats' ? openSafetyMenu : undefined}
        />
      </View>

      <View
        style={[styles.messageFabWrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.messageFab}
          onPress={openChat}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={`Message ${name || initialName || 'user'}`}
        >
          <Ionicons name="chatbubbles" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {myUserId && profileSource === 'chats' && (
        <BlockReportModal
          visible={reportOpen}
          reporterId={myUserId}
          reportedId={userId}
          reportedName={name || initialName || 'User'}
          onClose={() => setReportOpen(false)}
          onBlocked={() => {
            setReportOpen(false);
            navigation.goBack();
          }}
        />
      )}
      {profileSource === 'chats' && (
        <PeerSafetyActionsModal
          visible={peerSafetyOpen}
          otherUserId={userId}
          otherName={name || initialName || 'Profile'}
          start={peerSafetyStart}
          onClose={() => setPeerSafetyOpen(false)}
          onOpenReport={() => {
            setPeerSafetyOpen(false);
            setReportOpen(true);
          }}
          onAfterUnmatchOrBlock={() => {
            setPeerSafetyOpen(false);
            navigation.goBack();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F4F0',
  },
  card: {
    flex: 1,
    width: '100%',
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageFabWrap: {
    position: 'absolute',
    right: 18,
    alignItems: 'flex-end',
  },
  messageFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
});
