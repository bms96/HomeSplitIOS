import { useEffect } from 'react';

import { useAuthStore } from '@/stores/authStore';

/**
 * Convenience hook — returns the current auth state and actions.
 * Call `useAuthInitializer` once at the root to bootstrap the session listener.
 */
export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const mode = useAuthStore((s) => s.mode);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signInAsDevUser = useAuthStore((s) => s.signInAsDevUser);
  const signOut = useAuthStore((s) => s.signOut);

  return {
    session,
    user,
    isSignedIn: !!session,
    isInitialized,
    mode,
    signInWithEmail,
    signInAsDevUser,
    signOut,
  };
}

/**
 * Mount once at the app root to kick off `getSession()` and install the
 * `onAuthStateChange` listener. Renders nothing.
 */
export function useAuthInitializer() {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => {
    void initialize();
  }, [initialize]);
}
