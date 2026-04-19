import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function resolveProjectId(): string | undefined {
  const fromExpo = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.eas as
    | { projectId?: string }
    | undefined;
  const fromEas = Constants.easConfig as { projectId?: string } | undefined;
  return fromExpo?.projectId ?? fromEas?.projectId;
}

/**
 * Request permission + fetch the ExpoPushToken + upsert it to Postgres so
 * Edge Functions can fan out to the signed-in user's devices.
 * Safe to call in Expo Go — failures are swallowed and logged.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId = resolveProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    if (!token) return null;

    const platform: 'ios' | 'android' | 'web' =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' },
      );
    if (error) {
      console.warn('[push] upsert failed', error.message);
      return null;
    }
    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[push] register failed', message);
    return null;
  }
}

export async function unregisterPushTokenAsync(userId: string): Promise<void> {
  try {
    const projectId = resolveProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    if (!token) return;
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  } catch {
    // best-effort cleanup; ignore
  }
}
