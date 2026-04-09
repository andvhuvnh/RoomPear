import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import DiscoverScreen from '../screens/DiscoverScreen';
import MatchesScreen from '../screens/MatchesScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

export type MainTabParamList = {
  Discover: undefined;
  Matches: undefined;
  Messages: undefined;
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

function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{title}</Text>
    </View>
  );
}

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
      <Tab.Screen name="Messages" component={() => <Placeholder title="Messages" />} />
      <Tab.Screen name="Profile" component={UserProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDFDFD',
  },
  placeholderText: {
    fontSize: 18,
    color: '#2B3A4A',
  },
});
