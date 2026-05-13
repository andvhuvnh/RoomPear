import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Compass, Sparkle, ChatCircle, UserCircle } from 'phosphor-react-native';
import { supabase } from '../lib/supabase';
import { getProfileImageUrls } from '../lib/storage';
import { profilePhotoPathsFromRow } from '../lib/profileDisplay';
import DiscoverScreen from '../screens/DiscoverScreen';
import LikesStack, { type LikesStackParamList } from './LikesStack';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChatsStack, { type ChatsStackParamList } from './ChatsStack';

export type MainTabParamList = {
  Discover: undefined;
  Likes: NavigatorScreenParams<LikesStackParamList>;
  Chats: NavigatorScreenParams<ChatsStackParamList>;
  Profile: { onDevShowOnboarding?: () => void } | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ACTIVE = '#FFFFFF';
const TAB_INACTIVE = 'rgba(255,255,255,0.35)';
const TAB_BG = '#1A1A1A';

const TAB_ICONS: Record<keyof MainTabParamList, { icon: any }> = {
  Discover: { icon: Compass },
  Likes:    { icon: Sparkle },
  Chats:    { icon: ChatCircle },
  Profile:  { icon: UserCircle },
};

function GradientBadge({ count }: { count: number }) {
  return (
    <LinearGradient
      colors={['#EDF5EA', '#B7E4C7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        position: 'absolute',
        top: -6,
        right: -10,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}
    >
      <Text style={{ color: '#1B4332', fontSize: 10, fontWeight: '700', lineHeight: 18 }}>
        {count > 99 ? '99+' : count}
      </Text>
    </LinearGradient>
  );
}

interface Props {
  onDevShowOnboarding?: () => void;
}

export default function MainTabNavigator({ onDevShowOnboarding }: Props) {
  const [profileCoverUrl, setProfileCoverUrl] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const userIdRef = useRef<string | null>(null);

  const loadProfileCoverUrl = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_photo_url')
      .eq('id', userId)
      .single();
    if (error || !data) { setProfileCoverUrl(null); return; }
    const paths = profilePhotoPathsFromRow(data.profile_photo_url);
    if (paths.length === 0) { setProfileCoverUrl(null); return; }
    const urls = await getProfileImageUrls(data.profile_photo_url);
    setProfileCoverUrl(urls?.[0] ?? null);
  }, []);

  const loadBadgeCounts = useCallback(async (userId: string) => {
    const [inboundRes, mySwipesRes, convsRes] = await Promise.all([
      supabase
        .from('swipes')
        .select('swiper_id')
        .eq('swiped_id', userId)
        .in('direction', ['like', 'top_pick']),
      supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', userId),
      supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at, conversations!inner(last_message_at)')
        .eq('user_id', userId),
    ]);

    const alreadySwiped = new Set((mySwipesRes.data ?? []).map((r) => r.swiped_id));
    const pendingLikes = (inboundRes.data ?? []).filter((r) => !alreadySwiped.has(r.swiper_id));
    setLikeCount(pendingLikes.length);

    const convRows = convsRes.data ?? [];
    let unread = 0;
    for (const row of convRows) {
      const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;
      const lastMsg = conv?.last_message_at;
      const lastRead = row.last_read_at;
      if (lastMsg && (!lastRead || lastMsg > lastRead)) unread++;
    }
    setUnreadCount(unread);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (uid) {
        userIdRef.current = uid;
        loadProfileCoverUrl(uid);
        loadBadgeCounts(uid);
      } else {
        setProfileCoverUrl(null);
        setLikeCount(0);
        setUnreadCount(0);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id;
      if (uid) {
        userIdRef.current = uid;
        loadProfileCoverUrl(uid);
        loadBadgeCounts(uid);
      } else {
        userIdRef.current = null;
        setProfileCoverUrl(null);
        setLikeCount(0);
        setUnreadCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfileCoverUrl, loadBadgeCounts]);

  // Realtime refresh on new messages or swipes
  useEffect(() => {
    const channel = supabase
      .channel('nav-badge-refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        if (userIdRef.current) loadBadgeCounts(userIdRef.current);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'swipes' }, () => {
        if (userIdRef.current) loadBadgeCounts(userIdRef.current);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadBadgeCounts]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: false,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: TAB_BG,
          height: 82,
          paddingTop: 18,
          paddingBottom: 14,
        },
        tabBarIcon: ({ size, focused }) => {
          const name = route.name as keyof MainTabParamList;
          const badge = name === 'Likes' ? likeCount : name === 'Chats' ? unreadCount : 0;

          if (name === 'Profile' && profileCoverUrl) {
            const dim = size + 2;
            return (
              <View
                style={{
                  width: dim, height: dim, borderRadius: dim / 2,
                  borderWidth: focused ? 2 : StyleSheet.hairlineWidth,
                  borderColor: focused ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                  overflow: 'hidden', backgroundColor: '#333333',
                }}
              >
                <Image source={{ uri: profileCoverUrl }} style={{ width: dim, height: dim }} resizeMode="cover" />
              </View>
            );
          }

          const { icon: Icon } = TAB_ICONS[name];
          return (
            <View>
              <Icon size={size + 4} weight="bold" color={focused ? TAB_ACTIVE : TAB_INACTIVE} />
              {badge > 0 && <GradientBadge count={badge} />}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Likes" component={LikesStack} />
      <Tab.Screen name="Chats" component={ChatsStack} />
      <Tab.Screen
        name="Profile"
        component={UserProfileScreen}
        initialParams={{ onDevShowOnboarding }}
        listeners={{
          focus: () => {
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session?.user) loadProfileCoverUrl(session.user.id);
            });
          },
        }}
      />
    </Tab.Navigator>
  );
}
