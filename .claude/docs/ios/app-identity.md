# Homesplit iOS — App Identity & Configuration

> Identifiers and configuration that must stay consistent across the Xcode
> project, App Store Connect, Supabase dashboard, and RevenueCat dashboard.

---

## App identifiers

| Setting | Value | Location |
|---|---|---|
| Bundle ID | `app.homesplit.ios` | `HomesplitIOS.xcodeproj` → target → Signing & Capabilities |
| Display name | `Homesplit` | `Info.plist` → `CFBundleDisplayName` |
| Scheme | `homesplit` | `Info.plist` → `CFBundleURLTypes.CFBundleURLSchemes` |
| Universal-link domain | `https://homesplit.app` | Associated Domains entitlement: `applinks:homesplit.app` |
| Minimum iOS | 17.0 | Target Deployment Info |
| Supports iPad | ❌ (iPhone-only at launch) | Target → General |

Match the bundle ID across RC, App Store Connect, and `supabase/functions`
allowlists. If it ever drifts, universal links break silently.

---

## Deep linking

| Type | Value | Example |
|---|---|---|
| Custom scheme | `homesplit://` | `homesplit://join/abc123def` |
| Universal link | `https://homesplit.app/join/{token}` | Falls back to web when the app isn't installed |
| Auth callback | `homesplit://auth-callback?...` | Magic-link redirect |

**URL builders** live in `Domain/Deeplinks/Deeplinks.swift` (Venmo / Cash App /
invite URL).

**Apple-specific requirements:**
- Add `LSApplicationQueriesSchemes` to `Info.plist` for `venmo` and `cashapp`
  so `UIApplication.canOpenURL(_:)` returns true.
- Associated Domains entitlement: `applinks:homesplit.app`.
- Host `apple-app-site-association` on the domain with the app's team ID +
  bundle ID, paths `/join/*` and `/auth/*`.

---

## RevenueCat

| Key | Value |
|---|---|
| iOS API key | xcconfig `RC_IOS_KEY` (injected at build) |
| Entitlement ID | `pro_household` |
| Monthly product ID | `homesplit_pro_monthly` |
| App User ID | `household:{household_id}` — prefix the UUID with `household:` |

Why household-level: one person purchases, the whole household unlocks Pro. The
App User ID encodes the household so any member sees the same entitlement.

```swift
// Core/RevenueCat/RevenueCatService.swift
try await Purchases.shared.logIn("household:\(householdID.uuidString)")
```

**RevenueCat → Supabase webhook**: set in the RC dashboard to
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook` (if/when
the webhook Edge Function is added — the RN repo does not currently ship one).
The webhook updates the `subscriptions` table on every RC event. Until the
webhook exists, the client can call `Purchases.customerInfo()` directly and
mirror the result into `subscriptions` via an RPC.

---

## Supabase projects

| Environment | Project name | CLI ref env var | Used by |
|---|---|---|---|
| Dev / preview | `homesplit-dev` | `SUPABASE_DEV_REF` | Local dev + TestFlight (internal) |
| Production | `homesplit-prod` | `SUPABASE_PROD_REF` | TestFlight (external) + App Store |

Find project refs: `supabase projects list` after `supabase login`. Never commit
the actual refs — use environment variables or password manager entries.

---

## Xcode build configurations

| Configuration | xcconfig file | `APP_ENV` | Supabase project |
|---|---|---|---|
| Debug-Dev | `Config.Debug-Dev.xcconfig` | `development` | dev |
| Release-Dev | `Config.Release-Dev.xcconfig` | `development` | dev |
| Release-Prod | `Config.Release-Prod.xcconfig` | `production` | prod |

Values injected into `Info.plist` via build settings, then read at runtime by
`Configuration.swift` (see `patterns.md`).

**`.gitignore` additions**:

```
HomesplitIOS/SupportingFiles/Config.Debug-Dev.xcconfig
HomesplitIOS/SupportingFiles/Config.Release-Dev.xcconfig
HomesplitIOS/SupportingFiles/Config.Release-Prod.xcconfig
```

Commit `Config.Example.xcconfig` with all the keys and blank values so a new
contributor knows what to fill.

---

## Supabase Storage buckets

| Bucket | Access | Contents |
|---|---|---|
| `settlement-pdfs` | Authenticated (household members) | Move-out settlement PDFs at `{household_id}/{move_out_id}.pdf` |

Read policy is enforced by RLS on `storage.objects`; see the corresponding SQL
migration.

---

## PostHog events

Keep event names consistent across RN and iOS so dashboards don't fragment:

| Event | When | Properties |
|---|---|---|
| `expense_added` | User saves an expense | `{amount, split_type, member_count}` |
| `bill_created` | Recurring bill saved | `{frequency, has_custom_split}` |
| `household_created` | First household setup | `{}` |
| `member_invited` | Invite link shared | `{}` |
| `member_joined` | User joins via invite | `{}` |
| `paywall_shown` | Paywall screen displayed | `{trigger: 'member' | 'bill' | 'move_out'}` |
| `subscription_started` | RC purchase confirmed | `{product_id}` |
| `settle_up_initiated` | User taps Settle Up | `{method: 'venmo' | 'cashapp' | 'cash'}` |
| `move_out_completed` | Move-out flow finished | `{}` |

```swift
import PostHog
enum Analytics {
    static func track(_ event: String, _ props: [String: Any] = [:]) {
        PostHogSDK.shared.capture(event, properties: props)
    }
}
```

---

## Sentry

```swift
import Sentry
SentrySDK.start { options in
    options.dsn = Configuration.sentryDSN
    options.environment = Configuration.appEnv
    options.enabled = Configuration.isProd
}
```

Off in Debug so you're not spamming the DSN during development.

---

## Push notifications

| Setting | Value |
|---|---|
| Capability | Push Notifications, Background Modes (Remote notifications) |
| Table | `push_tokens` with `platform = 'ios'` |
| APNs env | sandbox in Debug, production in Release (matching provisioning) |

APNs device token is hex-encoded and upserted to Supabase on app launch once
permission is granted.

---

## URL schemes to declare in Info.plist

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>venmo</string>
    <string>cashapp</string>
</array>

<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>app.homesplit.ios</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>homesplit</string>
        </array>
    </dict>
</array>
```

---

## Keep this file updated

Every time you create an account on a new service, change a bundle ID, or change
an identifier, update the row here **and** the corresponding `Configuration`
key. This file has names and IDs only — never commit actual API keys.
