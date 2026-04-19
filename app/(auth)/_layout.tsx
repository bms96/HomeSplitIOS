import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
