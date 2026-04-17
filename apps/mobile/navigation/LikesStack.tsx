import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LikesScreen from '../screens/LikesScreen';
import PublicUserProfileScreen from '../screens/PublicUserProfileScreen';

export type LikesStackParamList = {
  LikesHome: undefined;
  ProfileView: { userId: string; name: string };
};

const Stack = createNativeStackNavigator<LikesStackParamList>();

export default function LikesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F4F7F9' },
      }}
    >
      <Stack.Screen name="LikesHome" component={LikesScreen} />
      <Stack.Screen name="ProfileView" component={PublicUserProfileScreen} />
    </Stack.Navigator>
  );
}
