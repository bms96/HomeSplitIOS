import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

export default function OnboardingLayout() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
