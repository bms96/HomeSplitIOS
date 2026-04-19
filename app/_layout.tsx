import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Colors } from '@/constants/colors';
import { useAuth, useAuthInitializer } from '@/hooks/useAuth';
import { useCurrentHousehold } from '@/hooks/useHousehold';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { configureRevenueCat, identifyHousehold } from '@/lib/revenuecat';

export default function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
    [],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <AuthGate />
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  useAuthInitializer();
  const { isInitialized, isSignedIn, user } = useAuth();
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id ?? null;

  useEffect(() => {
    configureRevenueCat();
  }, []);

  useEffect(() => {
    if (isSignedIn && householdId) {
      void identifyHousehold(householdId);
    }
  }, [isSignedIn, householdId]);

  useEffect(() => {
    if (isSignedIn && user?.id) {
      void registerForPushNotificationsAsync(user.id);
    }
  }, [isSignedIn, user?.id]);

  if (!isInitialized) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
});
