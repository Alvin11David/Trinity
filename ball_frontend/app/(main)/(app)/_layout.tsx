import { Stack } from 'expo-router';
import { useAuthStore } from '../../../src/store/authStore';
import { useRegisterPushToken } from '../../../src/hooks/usePushNotifications';

// This Stack is the fix for the back-navigation bug: it gives (tabs) and the
// league/team/player/match/post detail + compose/search screens a real, linear
// push history. The Drawer wraps this single Stack.
export default function AppStackLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Register the Expo push token once the user is authenticated (Step 7).
  useRegisterPushToken(isAuthenticated);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="league/[id]" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="player/[id]" />
      <Stack.Screen name="match/[id]" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="profile/[username]" />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/blocked" />
      <Stack.Screen name="search" />
      <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="chat/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/channels" />
      <Stack.Screen name="community/[id]" />
      <Stack.Screen name="teams" />
      <Stack.Screen name="players" />
    </Stack>
  );
}
