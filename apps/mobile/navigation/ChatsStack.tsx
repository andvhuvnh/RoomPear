import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatsScreen from '../screens/ChatsScreen';
import ChatScreen from '../screens/ChatScreen';
import PublicUserProfileScreen from '../screens/PublicUserProfileScreen';

export type ChatsStackParamList = {
  ChatsHome: undefined;
  Chat: { conversationId?: string; otherUserId?: string; title: string };
  ProfileView: {
    userId: string;
    name: string;
    /** When opened from Messages — opens existing thread in Chat. */
    conversationId?: string;
    /** Default chats; use `likes` when opened from Likes stack (cross-tab navigate). */
    profileSource?: 'chats' | 'likes';
  };
};

const Stack = createNativeStackNavigator<ChatsStackParamList>();

export default function ChatsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#1A2C24',
        headerTitleStyle: { fontWeight: '600', color: '#1A2C24' },
        headerStyle: { backgroundColor: '#F5FAF7' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen
        name="ChatsHome"
        component={ChatsScreen}
        options={{ headerShown: false, title: 'Chats' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="ProfileView"
        component={PublicUserProfileScreen}
        options={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}
      />
    </Stack.Navigator>
  );
}
