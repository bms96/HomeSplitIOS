import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { config } from '@/lib/config';
import type { Database } from '@/types/database';

/**
 * SecureStore-backed auth storage. Falls back to an in-memory map on web,
 * where SecureStore is not available.
 */
const memoryStore = new Map<string, string>();

const secureStoreAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return memoryStore.get(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      memoryStore.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      memoryStore.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
