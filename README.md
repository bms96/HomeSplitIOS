# Homesplit (iOS)

A household billing and expense-splitting app built exclusively for roommates.
Native iOS app in **Swift 6 / SwiftUI**, backed by **Supabase** (shared with the
former React Native build).

> The repo started life as a React Native + Expo clone. The TypeScript source is
> kept under version control as a **behavioral spec** for the Swift port, but
> nothing under `app/`, `components/`, `hooks/`, `utils/`, `lib/`, `stores/`,
> `constants/`, or `types/` ships in the iOS app. Active development happens in
> the Xcode project. See [`IOS_MIGRATION.md`](./IOS_MIGRATION.md) for parity
> status.

For full project context, architecture, and conventions, read
[`.claude/CLAUDE.md`](./.claude/CLAUDE.md) and the iOS docs under
[`.claude/docs/ios/`](./.claude/docs/ios/).

---

## Three core differentiators (don't compromise)

1. **Automated recurring bills** — set once, roll over every cycle.
2. **Move-out flow** — first-class roommate departure with proration + settlement PDF.
3. **Zero transaction limits on the free tier** — no daily caps, no ads, ever.

---

## Tech stack

| Layer | Technology |
|---|---|
| Language | Swift 6 (strict concurrency) |
| UI | SwiftUI, iOS 17+ |
| Navigation | `NavigationStack` per-tab + deeplink router |
| Backend client | `supabase-swift` (SPM) |
| Auth storage | Keychain via `AuthLocalStorage` |
| Subscriptions | RevenueCat + RevenueCatUI |
| Push | APNs via `UNUserNotificationCenter` |
| PDFs | PDFKit |
| Analytics | PostHog iOS SDK |
| Crash reporting | Sentry iOS SDK |
| Tests | Swift Testing (unit) + XCTest (UI smoke) |
| Package manager | Swift Package Manager (no CocoaPods) |
| Formatting | SwiftFormat |

---

## Prerequisites

- **macOS** with **Xcode 16+** and at least one iOS 17+ simulator runtime
  (Xcode → Settings → Components).
- **Supabase CLI** — `brew install supabase/tap/supabase`. Used for local
  Supabase + migrations + type generation.
- **Docker Desktop** (only if you plan to run the integration test plan
  locally — `supabase start` needs it).
- An Apple Developer account if you want to run on a physical device or
  push to TestFlight.
- Two Supabase projects (dev + prod). Refs are stored in your password
  manager / CI secret store, not in git.

---

## First-time setup

```bash
# 1. Clone
git clone <repo-url> HomesplitIOS && cd HomesplitIOS

# 2. Resolve Swift packages and open the project
xed HomesplitIOS.xcodeproj          # equivalent to opening from Finder
# Xcode will fetch SPM packages on first open. Wait for it to finish.

# 3. Create your local xcconfig files from the templates
cp HomesplitIOS/SupportingFiles/Config.Example.xcconfig \
   HomesplitIOS/SupportingFiles/Config.Debug-Dev.xcconfig
# (repeat for Release-Dev and Release-Prod, filling in the right values)

# 4. Apply database migrations to the dev project (one-time per fresh project)
supabase db push --project-ref $SUPABASE_DEV_REF
```

The xcconfig files are gitignored. Fill them in by hand or pull values from
your team's password manager. **Never commit xcconfig values.** See
[`.claude/docs/ios/app-identity.md`](./.claude/docs/ios/app-identity.md) for
the full key list.

---

## Build configurations

| Configuration | xcconfig | Supabase project | Use for |
|---|---|---|---|
| `Debug-Dev` | `Config.Debug-Dev.xcconfig` | dev | Daily simulator dev |
| `Release-Dev` | `Config.Release-Dev.xcconfig` | dev | TestFlight internal |
| `Release-Prod` | `Config.Release-Prod.xcconfig` | prod | TestFlight external + App Store |

Schemes:
- **HomesplitIOS** — the app target. Default to `Debug-Dev`.
- **HomesplitIOS (Release-Dev)** — TestFlight builds.
- **HomesplitIOS (Release-Prod)** — App Store builds.

Switch via Product → Scheme → Edit Scheme → Run → Build Configuration.

---

## Running the app

From Xcode:

1. Select an iPhone simulator (iPhone 16 Pro recommended).
2. Cmd-R to build & run.

From the CLI:

```bash
xcodebuild build \
  -scheme HomesplitIOS \
  -configuration Debug-Dev \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

To run on a physical device, sign the target with your Apple Developer team
in Signing & Capabilities. The bundle ID is `app.homesplit.ios`.

---

## Testing

```bash
# Unit tests (Swift Testing) — fast, no Supabase required
xcodebuild test \
  -scheme HomesplitIOS \
  -only-testing:HomesplitIOSTests/DomainTests \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'

# Full unit + view-model plan
xcodebuild test \
  -scheme HomesplitIOS \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'

# Coverage report
xcodebuild test \
  -scheme HomesplitIOS \
  -enableCodeCoverage YES \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

Integration tests (RLS / RPC / cross-household isolation) require a local
Supabase instance:

```bash
supabase start                          # one-time per session (Docker)
xcodebuild test \
  -scheme HomesplitIOS \
  -only-testing:HomesplitIOSTests/Integration \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

**Coverage targets:** 100 % on `Domain/Splits`, `Domain/Debts`,
`Domain/Proration`, `Domain/BillFrequency`. See
[`.claude/docs/ios/testing.md`](./.claude/docs/ios/testing.md).

---

## Database

The Supabase backend is **shared** with the legacy RN build. All schema lives
in `supabase/migrations/*.sql`. Migrations are append-only — never edit a file
that has been applied to any environment.

```bash
# Apply migrations to dev FIRST
supabase db push --project-ref $SUPABASE_DEV_REF

# Test thoroughly. Then promote to prod.
supabase db push --project-ref $SUPABASE_PROD_REF
```

```bash
# Deploy an Edge Function
supabase functions deploy process-recurring-bills --project-ref $SUPABASE_DEV_REF
```

Never run `supabase db reset` against prod.

---

## Project structure

The full target layout lives in
[`.claude/CLAUDE.md`](./.claude/CLAUDE.md). At a glance:

```
HomesplitIOS/
├── App/                # @main, scene, configuration, deeplink routing
├── Features/           # Auth, Onboarding, Dashboard, Expenses, Bills, Household, Settle, Paywall
├── Components/         # Reusable SwiftUI views
├── Core/               # Supabase client, RevenueCat, Notifications, Persistence
├── Domain/             # Pure Swift business logic — no SwiftUI/UIKit imports
├── DesignSystem/       # Colors, Spacing, Typography tokens
└── Resources/          # Assets, Info.plist, entitlements
HomesplitIOSTests/      # Swift Testing
HomesplitIOSUITests/    # XCUITest smoke flows
supabase/               # Shared backend (migrations + Edge Functions)
```

---

## Documentation

| Doc | What's in it |
|---|---|
| [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) | Root AI development context |
| [`.claude/docs/ios/architecture.md`](./.claude/docs/ios/architecture.md) | Layering, concurrency, navigation, DI |
| [`.claude/docs/ios/patterns.md`](./.claude/docs/ios/patterns.md) | Repository / view model / SwiftUI patterns + sample code |
| [`.claude/docs/ios/ui-ux.md`](./.claude/docs/ios/ui-ux.md) | Design tokens, screen specs, copy, accessibility |
| [`.claude/docs/ios/bills-vs-expenses.md`](./.claude/docs/ios/bills-vs-expenses.md) | The mental model that prevents bugs |
| [`.claude/docs/ios/testing.md`](./.claude/docs/ios/testing.md) | Test priorities + examples |
| [`.claude/docs/ios/backend-reference.md`](./.claude/docs/ios/backend-reference.md) | Tables, enums, RLS, RPCs, triggers, Edge Functions |
| [`.claude/docs/ios/app-identity.md`](./.claude/docs/ios/app-identity.md) | Bundle ID, schemes, RC keys, env config |
| [`.claude/docs/ios/migration-plan.md`](./.claude/docs/ios/migration-plan.md) | 10-phase strategy from bootstrap to App Store |
| [`IOS_MIGRATION.md`](./IOS_MIGRATION.md) | **Live parity tracker** — update as features land |
| [`.github/instructions/`](./.github/instructions/) | Auto-loaded scoped rule sheets for AI tools |

---

## Releasing

```bash
# Internal TestFlight (Release-Dev)
xcodebuild archive \
  -scheme "HomesplitIOS (Release-Dev)" \
  -archivePath build/HomesplitIOS-Dev.xcarchive

xcodebuild -exportArchive \
  -archivePath build/HomesplitIOS-Dev.xcarchive \
  -exportOptionsPlist HomesplitIOS/SupportingFiles/ExportOptions.plist \
  -exportPath build/

xcrun altool --upload-app -f build/HomesplitIOS.ipa \
  --type ios --apiKey $ASC_KEY_ID --apiIssuer $ASC_ISSUER
```

For App Store submission, swap to the `Release-Prod` scheme and submit via
App Store Connect.

---

## Status

**Current phase:** 0 — bootstrap. The Xcode project has not yet been generated.
See [`IOS_MIGRATION.md`](./IOS_MIGRATION.md) for the full feature checklist
and [`/.claude/docs/ios/migration-plan.md`](./.claude/docs/ios/migration-plan.md)
for the plan.
