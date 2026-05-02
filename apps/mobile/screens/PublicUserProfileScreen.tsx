import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
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
import { getPreferences, type Preferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import PublicProfileCard from '../components/PublicProfileCard';
import { ChatStyleTopBar } from '../components/ChatStyleTopBar';
import BlockReportModal from '../components/BlockReportModal';
import { CHATS_CARD, CHATS_GREEN, CHATS_GREEN_BORDER } from '../theme/chatsAmbient';
import PeerSafetyActionsModal, { type PeerSafetyStart } from '../components/PeerSafetyActionsModal';

type PromptEntry = { question: string; answer: string };

const C = {
  text: '#1A2C24',
  grayDim: '#A0A0B0',
  like: '#2D6A4F',
};

// Works for both ChatsStack and LikesStack since they share the same param shape
type Props =
  | NativeStackScreenProps<ChatsStackParamList, 'ProfileView'>
  | NativeStackScreenProps<LikesStackParamList, 'ProfileView'>;

function mergeInterestChips(prefs: Preferences | null, hobbies: string[]): string[] {
  const fromInterests = prefs?.interests
    ? (Object.values(prefs.interests).flat() as string[])
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...fromInterests, ...hobbies]) {
    const t = typeof s === 'string' ? s.trim() : '';
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

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

type ProfileRouteParams = {
  userId: string;
  name: string;
  conversationId?: string;
  profileSource?: 'chats' | 'likes';
};

export default function PublicUserProfileScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { userId, conversationId, profileSource = 'chats' } = route.params as ProfileRouteParams;
  const initialName = route.params.name ?? '';

  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState<string | null>(null);
  const [interestChips, setInterestChips] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, age, bio, hobbies, profile_photo_url, prompts')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      const hobbyList = Array.isArray(profile?.hobbies) ? profile.hobbies : [];

      if (profile) {
        setName(profile.name ?? initialName);
        setAge(typeof profile.age === 'number' ? profile.age : null);
        setBio(profile.bio ?? null);
        setPrompts(normalizePrompts(profile.prompts));

        const paths = profilePhotoPathsFromRow(profile.profile_photo_url);
        if (paths.length > 0) {
          const urls = await getProfileImageUrls(profile.profile_photo_url);
          if (!cancelled) setImageUrls(urls ?? []);
        } else if (!cancelled) {
          setImageUrls([]);
        }
      }

      const prefs = await getPreferences(userId);
      if (cancelled) return;

      setLocation(formatLocationLine(prefs));
      setInterestChips(mergeInterestChips(prefs, hobbyList));

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, initialName]);

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

  /** Space below floating bubbles so the card sits on the canvas, not under the pills. */
  const contentTopPad = insets.top + 56 + 12;

  const openSafetyMenu = useCallback(() => {
    if (profileSource !== 'chats') return;
    setPeerSafetyStart('main');
    setPeerSafetyOpen(true);
  }, [profileSource]);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.centered, { paddingTop: contentTopPad }]}>
          <ActivityIndicator color={C.like} size="large" />
        </View>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <ChatStyleTopBar
            title={initialName || 'Profile'}
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
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: contentTopPad,
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 96,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PublicProfileCard
          imageUrls={imageUrls}
          name={name}
          age={age}
          location={location}
          bio={bio}
          hobbies={interestChips}
          chipsSectionTitle={interestChips.length > 0 ? 'Interests' : null}
        />

        {prompts.length > 0 ? (
          <View style={styles.promptsBlock}>
            <Text style={styles.promptsHeading}>Prompts</Text>
            {prompts.map((p, i) => (
              <View key={`${p.question}-${i}`} style={styles.promptCard}>
                <View style={styles.promptAccent} />
                <View style={styles.promptContent}>
                  <Text style={styles.promptQuestion}>{p.question}</Text>
                  <Text style={styles.promptAnswer}>{p.answer}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <ChatStyleTopBar
          title={name || 'Profile'}
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
          <Ionicons name="chatbubbles" size={26} color={CHATS_GREEN} />
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
    /** Match card surface so safe-area padding above the card is not a visible “gray bar”. */
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
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
    backgroundColor: CHATS_CARD,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
    shadowColor: '#1A3329',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptsBlock: {
    marginTop: 20,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  promptsHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: C.grayDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  promptCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45,106,79,0.06)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  promptAccent: {
    width: 3,
    backgroundColor: C.like,
  },
  promptContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptQuestion: {
    fontSize: 11,
    fontWeight: '600',
    color: C.grayDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  promptAnswer: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    lineHeight: 22,
  },
});
