import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import UserProfileScreen from '../screens/UserProfileScreen';
import {
  DiscoverSwipePlaceholder,
  MatchesPlaceholder,
  MessagesPlaceholder,
} from '../screens/TabPlaceholderScreens';

export type MainTabParamList = {
  Home: undefined;
  Matches: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICON: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Matches: 'heart-outline',
  Messages: 'chatbubble-outline',
  Profile: 'person-outline',
};

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICON[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={DiscoverSwipePlaceholder}
        options={{ title: 'Home' }}
      />
      <Tab.Screen name="Matches" component={MatchesPlaceholder} />
      <Tab.Screen name="Messages" component={MessagesPlaceholder} />
      <Tab.Screen name="Profile" component={UserProfileScreen} />
    </Tab.Navigator>
  );
}
