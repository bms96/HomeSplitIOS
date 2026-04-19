# Homesplit

A household billing and expense-splitting app built exclusively for roommates. Built with React Native + Expo, Supabase, and TypeScript.

See [`CLAUDE.md`](./CLAUDE.md) for full project context, architecture, and conventions.

---

## Prerequisites

- **Node.js** 20+ and **npm**
- **Xcode** 16+ with at least one iOS simulator runtime installed (Xcode → Settings → Components)
- **CocoaPods** on PATH — verify with `pod --version`. Install with `sudo gem install cocoapods` or `brew install cocoapods`
- **Android Studio** (optional, for Android)
- **Expo CLI** — comes with `npx`, no global install needed
- **Supabase CLI** — `brew install supabase/tap/supabase`
- A Supabase project (dev) — see [supabase.com](https://supabase.com)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.development` in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
EXPO_PUBLIC_RC_IOS_KEY=your-revenuecat-ios-key
EXPO_PUBLIC_RC_ANDROID_KEY=your-revenuecat-android-key
EXPO_PUBLIC_POSTHOG_KEY=your-posthog-key
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

**Env file precedence:** dev + preview EAS profiles load `.env.development`; production builds load `.env.production` (set via `APP_ENV=production` in `eas.json`). `.env.local` overrides locally. All env files are gitignored — never commit them.

### 3. Apply database migrations

```bash
npx supabase db push --project-ref your-dev-ref
```

### 4. Generate Supabase types (after any schema change)

```bash
SUPABASE_PROJECT_ID=your-dev-ref npm run types:supabase
```

---

## Running the app

**Recommended workflow** — start Metro, then launch a target from the dev server:

```bash
npm start            # Start the Expo dev server (Metro)
# then press: i (iOS) · a (Android) · w (web)
```

If port 8081 is already in use or Metro is in a bad state:

```bash
lsof -ti:8081 | xargs kill -9 2>/dev/null; sleep 1; echo done
npx expo start --ios --clear
```

**Direct native build/install** — bypasses the Metro keypress and rebuilds from scratch:

```bash
npm run ios          # Build + install on iOS simulator
npm run android      # Build + install on Android emulator
npm run web          # Run in browser
```

### First-time iOS run

`npm run ios` (or pressing `i` against an uninstalled app) does **prebuild → CocoaPods install → Xcode build** on the first run, which takes 5–15 minutes. Make sure CocoaPods is on PATH first:

```bash
pod --version || sudo gem install cocoapods
npm run ios
```

If the build fails with `iOS X.Y is not installed`, install the matching runtime via **Xcode → Settings → Components**, or pick an installed simulator explicitly:

```bash
npx expo run:ios --device "iPhone 16 Pro"
```

---

## Testing

```bash
npm test                       # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # Coverage report
npx jest utils/debts.test.ts   # Run a single file
```

Money-math utilities (`utils/debts.ts`, `utils/splits.ts`, `utils/proration.ts`) require 100% coverage.

---

## Edge Functions

Deploy the recurring-bill cron job (always pass `--project-ref` to avoid hitting the wrong project):

```bash
npx supabase functions deploy process-recurring-bills --project-ref your-dev-ref
```

---

## Builds (EAS)

```bash
npx eas build --platform all --profile development   # Local dev client
npx eas build --platform all --profile preview       # Internal QA / TestFlight
npx eas build --platform all --profile production    # App Store / Play Store
npx eas update --branch production --message "..."   # JS-only OTA update
```

Promote migrations from dev → prod only after dev testing passes. Never run `supabase db reset` against prod.
