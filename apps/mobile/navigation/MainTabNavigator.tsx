import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { fonts } from '../lib/typography';
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

const TAB_ICON: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Discover: 'home-outline',
  Likes: 'heart-outline',
  Chats: 'chatbubbles-outline',
  Profile: 'person-outline',
};

const TAB_ICON_FOCUSED: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Discover: 'home',
  Likes: 'heart',
  Chats: 'chatbubbles',
  Profile: 'person',
};

const TAB_ACTIVE = '#0C5389';

interface Props {
  onDevShowOnboarding?: () => void;
}

export default function MainTabNavigator({ onDevShowOnboarding }: Props) {
  const [profileCoverUrl, setProfileCoverUrl] = useState<string | null>(null);

  const loadProfileCoverUrl = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_photo_url')
      .eq('id', userId)
      .single();
    if (error || !data) {
      setProfileCoverUrl(null);
      return;
    }
    const paths = profilePhotoPathsFromRow(data.profile_photo_url);
    if (paths.length === 0) {
      setProfileCoverUrl(null);
      return;
    }
    const urls = await getProfileImageUrls(data.profile_photo_url);
    setProfileCoverUrl(urls?.[0] ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfileCoverUrl(session.user.id);
      else setProfileCoverUrl(null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfileCoverUrl(session.user.id);
      else setProfileCoverUrl(null);
    });
    return () => subscription.unsubscribe();
  }, [loadProfileCoverUrl]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: {
          fontFamily: fonts.semiBold,
          fontSize: 11,
        },
        tabBarStyle: {
          borderTopColor: '#D9E1E6',
          backgroundColor: '#FDFDFD',
        },
        tabBarIcon: ({ color, size, focused }) => {
          const name = route.name as keyof MainTabParamList;
          if (name === 'Profile' && profileCoverUrl) {
            const dim = size + 2;
            return (
              <View
                style={{
                  width: dim,
                  height: dim,
                  borderRadius: dim / 2,
                  borderWidth: focused ? 2 : StyleSheet.hairlineWidth,
                  borderColor: focused ? TAB_ACTIVE : 'rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                  backgroundColor: '#E8E8E8',
                }}
              >
                <Image
                  source={{ uri: profileCoverUrl }}
                  style={{ width: dim, height: dim }}
                  resizeMode="cover"
                />
              </View>
            );
          }
          return (
            <Ionicons
              name={focused ? TAB_ICON_FOCUSED[name] : TAB_ICON[name]}
              size={size}
              color={color}
            />
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
