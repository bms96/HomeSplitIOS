import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { create } from 'zustand';

import { config } from '@/lib/config';
import { resetRevenueCatIdentity } from '@/lib/revenuecat';
import { supabase } from '@/lib/supabase';

type AuthMode = 'supabase' | 'dev-mock';

type AuthState = {
  session: Session | null;
  user: User | null;
  isInitialized: boolean;
  mode: AuthMode;
  initialize: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signInAsDevUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEV_USER_EMAIL = 'dev@homesplit.local';

function buildDevSession(): Session {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const user: User = {
    id: DEV_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: DEV_USER_EMAIL,
    app_metadata: { provider: 'dev' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  return {
    access_token: 'dev-access-token',
    refresh_token: 'dev-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSeconds + 3600,
    user,
  };
}

let listenerInstalled = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isInitialized: false,
  mode: 'supabase',

  initialize: async () => {
    if (get().isInitialized) return;

    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      isInitialized: true,
    });

    if (!listenerInstalled) {
      supabase.auth.onAuthStateChange((_event, session) => {
        if (get().mode === 'dev-mock') return;
        set({ session, user: session?.user ?? null });
      });
      listenerInstalled = true;
    }
  },

  signInWithEmail: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: Linking.createURL('/auth-callback') },
    });
    if (error) throw error;
  },

  signInAsDevUser: async () => {
    if (config.devEmail && config.devPassword) {
      const { error } = await supabase.auth.signInWithPassword({
        email: config.devEmail,
        password: config.devPassword,
      });
      if (error) throw error;
      return;
    }
    const session = buildDevSession();
    set({ session, user: session.user, mode: 'dev-mock' });
  },

  signOut: async () => {
    try {
      await resetRevenueCatIdentity();
    } catch {
      // ignore — RC may not be initialized (Expo Go / missing key)
    }
    const { mode } = get();
    if (mode === 'dev-mock') {
      set({ session: null, user: null, mode: 'supabase' });
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
}));
