import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LikesScreen from '../screens/LikesScreen';
import PublicUserProfileScreen from '../screens/PublicUserProfileScreen';
import { CHATS_SCREEN_BG } from '../theme/chatsAmbient';

export type LikesStackParamList = {
  LikesHome: undefined;
  ProfileView: {
    userId: string;
    name: string;
    conversationId?: string;
    profileSource?: 'chats' | 'likes';
  };
};

const Stack = createNativeStackNavigator<LikesStackParamList>();

export default function LikesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: CHATS_SCREEN_BG },
      }}
    >
      <Stack.Screen name="LikesHome" component={LikesScreen} />
      <Stack.Screen
        name="ProfileView"
        component={PublicUserProfileScreen}
        options={{ contentStyle: { backgroundColor: '#FFFFFF' } }}
      />
    </Stack.Navigator>
  );
}
