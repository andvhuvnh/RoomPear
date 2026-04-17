import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatsScreen from '../screens/ChatsScreen';
import ChatScreen from '../screens/ChatScreen';
import PublicUserProfileScreen from '../screens/PublicUserProfileScreen';

export type ChatsStackParamList = {
  ChatsHome: undefined;
  Chat: { conversationId?: string; otherUserId?: string; title: string };
  ProfileView: { userId: string; name: string };
};

const Stack = createNativeStackNavigator<ChatsStackParamList>();

export default function ChatsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#0C5389',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#E8EEF2' },
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
        options={{ headerBackTitle: 'Chats' }}
      />
      <Stack.Screen
        name="ProfileView"
        component={PublicUserProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
