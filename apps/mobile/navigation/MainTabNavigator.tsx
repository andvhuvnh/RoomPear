import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { House, Heart, ChatCircle, User } from 'phosphor-react-native';
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

const TAB_ACTIVE = '#1A3329';
const TAB_INACTIVE = '#9AADA6';
const TAB_BG = '#FFFFFF';

const TAB_ICONS: Record<keyof MainTabParamList, { icon: any; iconFilled: any }> = {
  Discover: { icon: House,       iconFilled: House },
  Likes:    { icon: Heart,       iconFilled: Heart },
  Chats:    { icon: ChatCircle,  iconFilled: ChatCircle },
  Profile:  { icon: User,        iconFilled: User },
};

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
        lazy: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarLabelStyle: {
          fontFamily: fonts.semiBold,
          fontSize: 11,
        },
        tabBarStyle: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '#E0EAE5',
          backgroundColor: TAB_BG,
        },
        tabBarIcon: ({ size, focused }) => {
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
                  borderColor: focused ? TAB_ACTIVE : TAB_INACTIVE,
                  overflow: 'hidden',
                  backgroundColor: '#E0EAE5',
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
          const { icon: Icon } = TAB_ICONS[name];
          return (
            <Icon
              size={size}
              weight={focused ? 'fill' : 'regular'}
              color={focused ? TAB_ACTIVE : TAB_INACTIVE}
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
