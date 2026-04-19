# Homesplit — App Identity & Configuration Constants

> Reference this file whenever you need bundle IDs, scheme names, RevenueCat IDs,
> or any identifier that must be consistent across the codebase, App Store Connect,
> Google Play Console, Supabase, and RevenueCat dashboards.

---

## App Identifiers

| Platform | Bundle / Package ID          | Notes |
|----------|------------------------------|-------|
| iOS      | `app.homesplit.ios`          | Set in `app.json` → `ios.bundleIdentifier` |
| Android  | `app.homesplit.android`      | Set in `app.json` → `android.package` |

```json
// app.json (relevant excerpt)
{
  "expo": {
    "name": "Homesplit",
    "slug": "homesplit",
    "scheme": "homesplit",
    "ios": {
      "bundleIdentifier": "app.homesplit.ios",
      "supportsTablet": false
    },
    "android": {
      "package": "app.homesplit.android",
      "adaptiveIcon": { "foregroundImage": "./assets/icon-fg.png", "backgroundColor": "#1F6FEB" }
    }
  }
}
```

---

## Deep Linking

| Type | Value | Example |
|------|-------|---------|
| Custom scheme | `homesplit://` | `homesplit://join/abc123def456` |
| Universal link (iOS) | `https://homesplit.app/join/{token}` | Fallback if app not installed |
| Android App Link | `https://homesplit.app/join/{token}` | Requires `assetlinks.json` on domain |

**Invite URL construction:**
```typescript
// Always prefer universal link — it falls back to web if app not installed
export const buildInviteUrl = (token: string) =>
  `https://homesplit.app/join/${token}`

// Deep link for in-app navigation only (when app is confirmed open)
export const buildInviteDeepLink = (token: string) =>
  `homesplit://join/${token}`
```

**Expo Router deep link config** (already set via `scheme: "homesplit"` in app.json):
```typescript
// app/(auth)/join/[token].tsx is automatically reached by:
// homesplit://join/TOKEN
// https://homesplit.app/join/TOKEN  (after associating domain in Apple/Google consoles)
```

---

## RevenueCat

| Key | Value |
|-----|-------|
| iOS SDK key | Set in `.env` as `EXPO_PUBLIC_RC_IOS_KEY` |
| Android SDK key | Set in `.env` as `EXPO_PUBLIC_RC_ANDROID_KEY` |
| Entitlement ID | `pro_household` |
| Monthly product ID (iOS) | `homesplit_pro_monthly` |
| Monthly product ID (Android) | `homesplit_pro_monthly` |
| RC Customer ID | `household:{household_id}` (prefix household UUID with "household:") |

**Why household-level, not user-level:**
RevenueCat is configured per household, not per user. One person purchases, the whole household gets Pro. The RC customer ID encodes the household so any member querying entitlements gets the same answer.

```typescript
// lib/revenuecat.ts
export const RC_ENTITLEMENT = 'pro_household'
export const RC_PRODUCT_ID  = 'homesplit_pro_monthly'

export async function initRevenueCat(householdId: string) {
  Purchases.configure({
    apiKey: Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!,
  })
  // Use household ID as RC customer — not user ID
  await Purchases.logIn(`household:${householdId}`)
}

export async function isProHousehold(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo()
    return !!info.entitlements.active[RC_ENTITLEMENT]
  } catch {
    // If RC is unreachable, fall back to cached Supabase status
    return false
  }
}
```

**RevenueCat webhook → Supabase:**
In the RC dashboard, set webhook URL to your Supabase Edge Function:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook`

The webhook updates the `subscriptions` table on every RC event (purchase, renewal, cancellation).

---

## Supabase Projects

| Environment | Project Name | CLI Ref | Used By |
|-------------|-------------|---------|---------|
| Dev / Preview | `homesplit-dev` | `YOUR_DEV_REF` | Local dev + TestFlight builds |
| Production | `homesplit-prod` | `YOUR_PROD_REF` | App Store + Google Play |

Replace `YOUR_DEV_REF` and `YOUR_PROD_REF` with the actual project ref from your Supabase dashboard URL:
`https://supabase.com/dashboard/project/YOUR_REF_IS_HERE`

**Finding your project ref:**
```bash
# After running `supabase login`:
npx supabase projects list
```

---

## EAS / Build Identifiers

```bash
# EAS project — created once with:
npx eas init

# EAS project ID is written to app.json automatically:
# "extra": { "eas": { "projectId": "YOUR_EAS_PROJECT_ID" } }
```

| Profile | Environment | Distribution |
|---------|-------------|-------------|
| `development` | dev Supabase | Internal (simulator) |
| `preview` | dev Supabase | Internal (TestFlight / Firebase App Distribution) |
| `production` | prod Supabase | App Store + Google Play |

---

## Supabase Storage Buckets

| Bucket | Access | Contents |
|--------|--------|----------|
| `settlement-pdfs` | Authenticated (member of household) | Move-out settlement PDFs |

```sql
-- Create bucket (run in Supabase SQL editor or migration)
insert into storage.buckets (id, name, public)
values ('settlement-pdfs', 'settlement-pdfs', false);

-- Storage policy: household members can read their own PDFs
create policy "settlement_pdf_read" on storage.objects
  for select using (
    bucket_id = 'settlement-pdfs'
    and is_household_member(
      -- PDF path format: {household_id}/{move_out_id}.pdf
      (string_to_array(name, '/'))[1]::uuid
    )
  );
```

---

## PostHog Events (Analytics)

These are the events Claude Code should emit. Keep event names consistent — they're used in PostHog dashboards.

| Event | When | Properties |
|-------|------|------------|
| `expense_added` | User saves expense | `{amount, split_type, member_count}` |
| `bill_created` | Recurring bill saved | `{frequency, has_custom_split}` |
| `household_created` | First household setup | `{}` |
| `member_invited` | Invite link shared | `{}` |
| `member_joined` | User joins via invite | `{}` |
| `paywall_shown` | Paywall screen displayed | `{trigger: 'member'|'bill'|'move_out'}` |
| `subscription_started` | RC purchase confirmed | `{product_id}` |
| `settle_up_initiated` | User taps Settle Up | `{method: 'venmo'|'cashapp'|'cash'}` |
| `move_out_completed` | Move-out flow finished | `{}` |

```typescript
// utils/analytics.ts
import PostHog from 'posthog-react-native'

export const track = (event: string, props?: Record<string, unknown>) => {
  PostHog.capture(event, props)
}
```

---

## Sentry

```typescript
// app/_layout.tsx (root layout)
import * as Sentry from '@sentry/react-native'

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.APP_ENV ?? 'development',
  enabled: process.env.APP_ENV === 'production',  // off in dev
})
```

---

## OneSignal (Push Notifications)

> Expo Push Notifications is sufficient at launch. Migrate to OneSignal when you need
> rich notifications with images or need better analytics. The schema supports both.

```typescript
// lib/notifications.ts — Expo Push approach
import * as Notifications from 'expo-notifications'

export async function registerPushToken(memberId: string) {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const token = (await Notifications.getExpoPushTokenAsync()).data
  await supabase
    .from('members')
    .update({ push_token: token })
    .eq('id', memberId)
  // Note: add push_token column in migration 002
}
```

---

*Keep this file updated whenever you create accounts in a new service or change identifiers.*
*Never commit actual API keys — this file contains names/IDs only, not secrets.*
