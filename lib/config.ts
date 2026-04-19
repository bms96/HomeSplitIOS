/**
 * Single source of truth for environment configuration.
 * Every other module reads env vars through this file — never via process.env directly.
 */

type AppEnv = 'development' | 'production';

function readEnv(key: string, fallback = ''): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const appEnv = (readEnv('APP_ENV', 'development') as AppEnv);

/**
 * When Supabase credentials are missing, we run in "local mock" mode —
 * the client is pointed at a deliberately-invalid URL and network calls fail fast.
 * Switch to a real stack by either:
 *   (a) starting the hosted dev project and filling in .env.development, or
 *   (b) running `npx supabase start` locally and pointing at http://localhost:54321
 */
export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export const config = {
  supabaseUrl: supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey: supabaseAnonKey || 'public-anon-key-placeholder',
  revenueCatIosKey: readEnv('EXPO_PUBLIC_RC_IOS_KEY'),
  revenueCatAndroidKey: readEnv('EXPO_PUBLIC_RC_ANDROID_KEY'),
  posthogKey: readEnv('EXPO_PUBLIC_POSTHOG_KEY'),
  sentryDsn: readEnv('EXPO_PUBLIC_SENTRY_DSN'),
  devEmail: readEnv('EXPO_PUBLIC_DEV_EMAIL'),
  devPassword: readEnv('EXPO_PUBLIC_DEV_PASSWORD'),
  appEnv,
  isProd: appEnv === 'production',
  isSupabaseConfigured,
} as const;

export type Config = typeof config;
