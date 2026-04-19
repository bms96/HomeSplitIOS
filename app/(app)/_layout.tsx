import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentHousehold } from '@/hooks/useHousehold';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(focusedName: IoniconName, unfocusedName: IoniconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : unfocusedName} size={size} color={color} />
  );
}

export default function AppTabsLayout() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  const { data: membership, isLoading, isError } = useCurrentHousehold();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!isError && membership === null) {
    return <Redirect href="/create-household" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.mid,
        tabBarStyle: { backgroundColor: Colors.white },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="expenses/index"
        options={{ title: 'Expenses', tabBarIcon: tabIcon('receipt', 'receipt-outline') }}
      />
      <Tabs.Screen name="expenses/add" options={{ href: null }} />
      <Tabs.Screen name="expenses/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="bills/index"
        options={{ title: 'Bills', tabBarIcon: tabIcon('repeat', 'repeat-outline') }}
      />
      <Tabs.Screen name="bills/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="household/index"
        options={{ title: 'Household', tabBarIcon: tabIcon('people', 'people-outline') }}
      />
      <Tabs.Screen name="household/invite" options={{ href: null }} />
      <Tabs.Screen name="household/move-out" options={{ href: null }} />
      <Tabs.Screen name="household/categories" options={{ href: null }} />
      <Tabs.Screen name="household/settings" options={{ href: null }} />
      <Tabs.Screen name="settle" options={{ href: null }} />
      <Tabs.Screen name="balances/[memberId]" options={{ href: null }} />
      <Tabs.Screen name="paywall" options={{ href: null }} />
    </Tabs>
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
