import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DiscoverScreen from '../screens/DiscoverScreen';
import LikesScreen from '../screens/LikesScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChatsStack, { type ChatsStackParamList } from './ChatsStack';

export type MainTabParamList = {
  Discover: undefined;
  Likes: undefined;
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

interface Props {
  onDevShowOnboarding?: () => void;
}

export default function MainTabNavigator({ onDevShowOnboarding }: Props) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#0C5389',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          borderTopColor: '#D9E1E6',
          backgroundColor: '#FDFDFD',
        },
        tabBarIcon: ({ color, size, focused }) => {
          const name = route.name as keyof MainTabParamList;
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
      <Tab.Screen name="Likes" component={LikesScreen} />
      <Tab.Screen name="Chats" component={ChatsStack} />
      <Tab.Screen
        name="Profile"
        component={UserProfileScreen}
        initialParams={{ onDevShowOnboarding }}
      />
    </Tab.Navigator>
  );
}
