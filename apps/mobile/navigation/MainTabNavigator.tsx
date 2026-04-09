import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DiscoverScreen from '../screens/DiscoverScreen';
import MatchesScreen from '../screens/MatchesScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import MessagesStack, { type MessagesStackParamList } from './MessagesStack';

export type MainTabParamList = {
  Discover: undefined;
  Matches: undefined;
  Messages: NavigatorScreenParams<MessagesStackParamList>;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICON: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Discover: 'home-outline',
  Matches: 'heart-outline',
  Messages: 'chatbubble-outline',
  Profile: 'person-outline',
};

const TAB_ICON_FOCUSED: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Discover: 'home',
  Matches: 'heart',
  Messages: 'chatbubble',
  Profile: 'person',
};

export default function MainTabNavigator() {
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
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={UserProfileScreen} />
    </Tab.Navigator>
  );
}
