import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import UserProfileScreen from '../screens/UserProfileScreen';
import MessagesStack from './MessagesStack';
import { DiscoverSwipePlaceholder, MatchesPlaceholder } from '../screens/TabPlaceholderScreens';

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

const TAB_ICON_FOCUSED: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
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
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: '#888',
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
      <Tab.Screen
        name="Home"
        component={DiscoverSwipePlaceholder}
        options={{ title: 'Home' }}
      />
      <Tab.Screen name="Matches" component={MatchesPlaceholder} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={UserProfileScreen} />
    </Tab.Navigator>
  );
}
