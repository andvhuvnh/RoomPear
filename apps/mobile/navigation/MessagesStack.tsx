import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MessagesListScreen from '../screens/MessagesListScreen';
import ChatScreen from '../screens/ChatScreen';

export type MessagesStackParamList = {
  ConversationList: undefined;
  Chat: { conversationId: string; title: string };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export default function MessagesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#0C5389',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#E8EEF2' },
      }}
    >
      <Stack.Screen
        name="ConversationList"
        component={MessagesListScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
