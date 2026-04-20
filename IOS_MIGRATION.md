# Homesplit iOS — Feature Parity Tracker

> Live checklist of every React Native feature and its Swift / SwiftUI counterpart.
> Strategy and phase ordering live in [`.claude/docs/ios/migration-plan.md`](.claude/docs/ios/migration-plan.md).
> **Update this file as each row lands** — when a feature reaches "Done" in the iOS app,
> tick the box and fill the owning Swift file(s).

**Status legend**

| Symbol | Meaning |
|---|---|
| ☐ | Not started |
| ◐ | In progress (partially built or behind a flag) |
| ☑ | Done (shipped to dev build, behavior matches RN, tests where required) |
| ➖ | Intentionally deferred (post-MVP) — see notes |
| ✂︎ | Removed by design (RN-only or out of iOS scope) |

**Last updated:** 2026-04-19
**Repo branch:** `main`

---

## 0 · Phase rollup

| Phase | Status | Notes |
|---|---|---|
| 0 — Bootstrap (Xcode project, SPM, CI) | ☐ | Not yet generated |
| 1 — Domain port (`utils/*` → `Domain/*`) | ☐ | |
| 2 — Core plumbing (Supabase, Keychain, RC, push) | ☐ | |
| 3 — Auth + onboarding | ☐ | |
| 4 — Dashboard + Expenses | ☐ | |
| 5 — Bills | ☐ | |
| 6 — Settle + Balance breakdown | ☐ | |
| 7 — Household management | ☐ | |
| 8 — Move-out | ☐ | |
| 9 — Paywall + RevenueCat | ☐ | |
| 10 — Polish + release prep | ☐ | |

---

## 1 · Bootstrap & Tooling

| Item | Status | Owning file(s) | Notes |
|---|---|---|---|
| `HomesplitIOS.xcodeproj` (iOS 17 min, iPhone-only, SwiftUI App) | ☐ | `HomesplitIOS.xcodeproj` | |
| SPM dependencies: `supabase-swift`, `RevenueCat`, `RevenueCatUI`, `posthog-ios`, `sentry-cocoa` | ☐ | `Package.resolved` | |
| Xcconfig: `Config.Debug-Dev`, `Config.Release-Dev`, `Config.Release-Prod` + `Config.Example` | ☐ | `HomesplitIOS/SupportingFiles/` | |
| `Configuration.swift` — Info.plist reader for env values | ☐ | `HomesplitIOS/App/Configuration.swift` | |
| Swift Testing target (`HomesplitIOSTests`) | ☐ | `HomesplitIOSTests/` | |
| XCUITest smoke target (`HomesplitIOSUITests`) | ☐ | `HomesplitIOSUITests/` | |
| GitHub Actions CI (Unit plan on PR) | ☐ | `.github/workflows/ios-ci.yml` | |
| SwiftFormat / swift-format pre-commit | ☐ | `.swiftformat` | |
| Entitlements: Push, Associated Domains (`applinks:homesplit.app`), Keychain | ☐ | `HomesplitIOS/SupportingFiles/HomesplitIOS.entitlements` | |
| Info.plist: URL scheme `homesplit`, `LSApplicationQueriesSchemes` for `venmo`/`cashapp` | ☐ | `HomesplitIOS/Resources/Info.plist` | |

---

## 2 · Domain (`utils/*.ts` → `Domain/*.swift`)

P1 ship-blocker: 100 % test coverage on every row in this section.

| RN source | iOS target | Status | Owning file(s) | Tests | Notes |
|---|---|---|---|---|---|
| `utils/currency.ts` | `Domain/Money/Money.swift` | ☐ | | ☐ | Decimal parse + `formatted(.currency(...))` |
| `utils/splits.ts` | `Domain/Splits/Splits.swift` | ☐ | | ☐ | Equal / pct / exact + first-member-absorbs-remainder |
| `utils/debts.ts` | `Domain/Debts/Debts.swift` | ☐ | | ☐ | Greedy simplify, pairwise, payer-self-split skip |
| `utils/proration.ts` | `Domain/Proration/Proration.swift` | ☐ | | ☐ | Days-present, household-tz-aware |
| `utils/billFrequency.ts` | `Domain/BillFrequency/BillFrequency.swift` | ☐ | | ☐ | End-of-month clamp matches migration 014 |
| `utils/billStatus.ts` | `Domain/BillStatus/BillStatus.swift` | ☐ | | ☐ | `isFullyPaid`, `isOverdue` predicates |
| `utils/cardState.ts` | `Domain/CardState/CardState.swift` | ☐ | | ☐ | Tone enum for dashboard cards |
| `utils/deeplinks.ts` | `Domain/Deeplinks/Deeplinks.swift` | ☐ | | ☐ | Venmo / Cash App / invite URL builders |
| Domain models | `Domain/Models/*` | ☐ | | n/a | Household, Member, Expense, ExpenseSplit, RecurringBill, BillingCycle, Settlement, MoveOut, Subscription |
| Domain enums | `Domain/Enums/*` | ☐ | | n/a | ExpenseCategory, SettlementMethod, BillFrequency, SplitType, SubscriptionStatus |

---

## 3 · Core plumbing

| Capability | RN reference | iOS target | Status | Owning file(s) | Notes |
|---|---|---|---|---|---|
| Supabase client singleton + protocol | `lib/supabase.ts` | `Core/Supabase/SupabaseClientProvider.swift` | ☐ | | Inject via env; never instantiate in views |
| Keychain auth storage | Expo SecureStore in `lib/supabase.ts` | `Core/Persistence/KeychainAuthStorage.swift` | ☐ | | `AuthLocalStorage` adapter |
| `AppSession` (auth-state observer) | `stores/authStore.ts` | `App/AppSession.swift` | ☐ | | Wires repositories, observes auth changes |
| Auth repository | `useAuth.ts` | `Core/Supabase/Repositories/AuthRepository.swift` | ☐ | | Magic-link send, sign-out, session restore |
| Households repository | `hooks/useHousehold.ts` | `Core/Supabase/Repositories/HouseholdsRepository.swift` | ☐ | | CRUD + `create_household`, `rotate_invite_token` |
| Members repository | (inline in `useHousehold`) | `Core/Supabase/Repositories/MembersRepository.swift` | ☐ | | Active filter; `was_household_member` aware |
| Cycles repository | (inline) | `Core/Supabase/Repositories/CyclesRepository.swift` | ☐ | | Read current open cycle |
| RevenueCat service | `lib/revenuecat.ts` | `Core/RevenueCat/RevenueCatService.swift` | ☐ | | `logIn("household:\(uuid)")`, entitlement check |
| Notifications service | `lib/notifications.ts` | `Core/Notifications/NotificationsService.swift` | ☐ | | APNs token → `push_tokens` upsert |
| Logger | `console.log` | `os.Logger` wrappers | ☐ | `Core/Logging.swift` | Per-subsystem categories; off in Release |
| Analytics shim | `lib/analytics.ts` (PostHog) | `Core/Analytics.swift` | ☐ | | Match RN event names exactly |
| Sentry init | `lib/sentry.ts` | `Core/Crash/SentryService.swift` | ☐ | | Off in DEBUG |

---

## 4 · Auth & Onboarding

| RN screen | iOS screen | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(auth)/sign-in.tsx` | `Features/Auth/SignInView.swift` | ☐ | | Magic-link email entry; `#if DEBUG` dev bypass |
| Magic-link callback handler | `Features/Auth/AuthCallbackView.swift` | ☐ | | `homesplit://auth-callback?...` |
| `app/(auth)/join/[token].tsx` | `Features/Onboarding/JoinHouseholdView.swift` | ☐ | | Universal link `https://homesplit.app/join/{token}` |
| First-run: create household | `Features/Onboarding/CreateHouseholdView.swift` | ☐ | | Calls `create_household` RPC |
| Root router (auth / onboarding / tabs) | `App/HomesplitApp.swift` + `App/RootRouter.swift` | ☐ | | Decides based on `AppSession` |

---

## 5 · Tabs & Dashboard

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| Tab bar (Home / Expenses / Bills / Household) | `App/RootTabView.swift` | ☐ | | 4 tabs, badges only on Home + Bills |
| Dashboard screen | `Features/Dashboard/DashboardView.swift` | ☐ | | Balances, "you owe", bills due, recent expenses |
| Dashboard stat cards | `Components/Cards/BalanceCard.swift`, `Components/Cards/StatCard.swift` | ☐ | | Tones from `Domain/CardState/` |
| Recent transactions list | `Features/Dashboard/RecentTransactionsSection.swift` | ☐ | | Top N expenses + settlements |
| Add-expense FAB / toolbar entry | (folded into `DashboardView` toolbar) | ☐ | | Sheets `AddExpenseView` |

---

## 6 · Expenses

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/expenses/index.tsx` | `Features/Expenses/ExpensesListView.swift` | ☐ | | Filter chips, sort, pull-to-refresh, swipe actions |
| `app/(app)/expenses/add.tsx` (sheet) | `Features/Expenses/AddExpenseView.swift` | ☐ | | `.sheet` + `.presentationDetents` |
| Expense detail / edit | `Features/Expenses/ExpenseDetailView.swift` | ☐ | | View/edit modes, mark-paid, delete |
| ExpensesRepository | `Core/Supabase/Repositories/ExpensesRepository.swift` | ☐ | | CRUD + splits |
| BalancesRepository | `Core/Supabase/Repositories/BalancesRepository.swift` | ☐ | | Reads splits; runs through `Domain/Debts/` |
| Category preferences | `Core/Supabase/Repositories/CategoryPreferencesRepository.swift` | ☐ | | Hidden + custom labels |
| Add-expense view model | `Features/Expenses/AddExpenseViewModel.swift` | ☐ | | State machine: `idle → saving → saved/failed` |

---

## 7 · Bills

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/bills/index.tsx` | `Features/Bills/BillsListView.swift` | ☐ | | "Paid this cycle" indicator per member |
| `app/(app)/bills/[id].tsx` (create/edit) | `Features/Bills/BillFormView.swift` | ☐ | | Frequency, amount or variable, split type, exclusions |
| Bill detail | `Features/Bills/BillDetailView.swift` | ☐ | | Cycle override entry, mark-paid toggle, delete |
| RecurringBillsRepository | `Core/Supabase/Repositories/RecurringBillsRepository.swift` | ☐ | | |
| BillCyclePaymentsRepository | `Core/Supabase/Repositories/BillCyclePaymentsRepository.swift` | ☐ | | Insert/delete `(bill, cycle, member)` |
| BillCycleAmountsRepository | `Core/Supabase/Repositories/BillCycleAmountsRepository.swift` | ☐ | | Variable bill cycle override |
| Variable-bill mark-paid gate | (in `BillDetailViewModel`) | ☐ | | Match `bcp_enforce_amount` trigger UX |

---

## 8 · Settle Up & Balance Breakdown

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/settle.tsx` | `Features/Settle/SettleView.swift` | ☐ | | Net pairwise debts, "Pay" + "Mark paid" |
| Per-member breakdown | `Features/Settle/BalanceBreakdownView.swift` | ☐ | | Current cycle |
| `settle_pair` RPC wrapper | `SettlementsRepository.settlePair(...)` | ☐ | `Core/Supabase/Repositories/SettlementsRepository.swift` | |
| Venmo / Cash App handoff | `UIApplication.open(_:)` from `Domain/Deeplinks/` | ☐ | | |

---

## 9 · Household Management

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/household/index.tsx` | `Features/Household/HouseholdView.swift` | ☐ | | Members, invite, categories, move-out, settings, sign-out |
| `app/(app)/household/invite.tsx` | `Features/Household/InviteView.swift` | ☐ | | Copy + share + rotate invite URL |
| Categories management | `Features/Household/CategoriesView.swift` | ☐ | | Wraps `expense_category_preferences` |
| Household settings | `Features/Household/SettingsView.swift` | ☐ | | Rename household / self; `#if DEBUG` reset |
| Member rename / color edit | `Features/Household/MemberEditView.swift` | ☐ | | |

---

## 10 · Move-Out

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/household/move-out.tsx` (multi-step) | `Features/Household/MoveOutFlow/` | ☐ | | Pick → review → done |
| `complete_move_out` RPC wrapper | `MoveOutRepository.complete(...)` | ☐ | `Core/Supabase/Repositories/MoveOutRepository.swift` | |
| PDF generation | `Features/Household/MoveOutFlow/MoveOutPDF.swift` | ☐ | | PDFKit; layout matches RN `docs/patterns.md` |
| PDF upload to Storage | (in `MoveOutRepository`) | ☐ | | `settlement-pdfs/{household_id}/{move_out_id}.pdf` |
| Paywall gate at flow start | (in `MoveOutFlow`) | ☐ | | Calls `requireProOrPresent(_:)` |

---

## 11 · Paywall & RevenueCat

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| Paywall screen | `Features/Paywall/PaywallView.swift` | ☐ | | `RevenueCatUI` paywall when available; fallback otherwise |
| Paywall gate (3rd member, 3rd bill, move-out) | `Features/Paywall/PaywallGate.swift` | ☐ | | Pure decision function; tests in P3 |
| RC identify on sign-in / reset on sign-out | (in `RevenueCatService`) | ☐ | | App User ID = `household:{uuid}` |
| RevenueCat → Supabase webhook | (open question — see migration plan) | ➖ | | Decide during Phase 9 whether to add Edge Function |

---

## 12 · Push Notifications

| Capability | iOS target | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| Permission request | `Core/Notifications/NotificationsService.swift` | ☐ | | After first successful sign-in |
| APNs token registration | `App/HomesplitApp.swift` (`UIApplicationDelegateAdaptor`) | ☐ | | Hex-encode + upsert to `push_tokens` |
| Foreground notification handling | `NotificationsService.userNotificationCenter(_:willPresent:...)` | ☐ | | Show banner + sound |
| Tap-through deeplink | `NotificationsService.userNotificationCenter(_:didReceive:...)` | ☐ | | Routes through `HomesplitApp.onOpenURL` |

---

## 13 · Deep Links

| Pattern | iOS handler | Status | Notes |
|---|---|---|---|
| `homesplit://join/{token}` | `App/Routing/DeeplinkRouter.swift` | ☐ | Push onto Onboarding |
| `https://homesplit.app/join/{token}` (universal link) | same | ☐ | Requires `apple-app-site-association` hosted on domain |
| `homesplit://auth-callback?...` | same | ☐ | Magic-link return |
| Venmo handoff | `Domain/Deeplinks/Deeplinks.swift` | ☐ | Build URL only — `UIApplication.open(_:)` from view |
| Cash App handoff | same | ☐ | |

---

## 14 · Design System

| Token | iOS file | Status | Notes |
|---|---|---|---|
| Color palette | `DesignSystem/Colors.swift` + `Assets.xcassets` semantic colors | ☐ | Light + Dark variants |
| Typography scale | `DesignSystem/Typography.swift` | ☐ | Prefer SwiftUI semantic styles |
| Spacing (4 pt grid) | `DesignSystem/Spacing.swift` | ☐ | |
| Shadows / elevation | `DesignSystem/Elevation.swift` | ☐ | |
| Reusable primitives | `Components/Primitives/HSButton.swift`, `HSTextField.swift`, `HSCurrencyField.swift` | ☐ | |
| Reusable cards | `Components/Cards/*` | ☐ | |
| `MemberAvatar` | `Components/MemberAvatar.swift` | ☐ | |

---

## 15 · Testing

| Test plan | Status | Notes |
|---|---|---|
| Domain unit tests (Swift Testing) | ☐ | P1 ship blocker — 100 % on `Domain/` |
| ViewModel state-machine tests | ☐ | P3 |
| RLS integration tests (local Supabase) | ☐ | P2 — eight scenarios from `.claude/docs/ios/testing.md` |
| Decoder fixtures | ☐ | One JSON per DTO in `HomesplitIOSTests/Fixtures/` |
| XCUITest smoke (launch + sign-in reachable + tab bar present) | ☐ | One file: `HomesplitIOSUITests/SmokeFlowTests.swift` |
| CI test plan wired to PRs (Unit only) | ☐ | |

---

## 16 · Release Prep

| Item | Status | Notes |
|---|---|---|
| App icon (all required sizes) | ☐ | `Assets.xcassets/AppIcon.appiconset` |
| Launch screen | ☐ | `Assets.xcassets/LaunchImage` or storyboard |
| Privacy manifest (`PrivacyInfo.xcprivacy`) | ☐ | Required for App Store submission |
| App Store Connect listing (name, subtitle, keywords, screenshots) | ☐ | |
| TestFlight build (internal) | ☐ | Release-Dev |
| TestFlight external testers | ☐ | Release-Prod |
| App Store submission | ☐ | |

---

## 17 · Intentionally deferred / removed

| Item | Why | Status |
|---|---|---|
| iPad layout | iPhone-only at launch | ➖ |
| Web target (`react-native-web`) | iOS rewrite is iPhone-only | ✂︎ |
| Widgets / Live Activities | Stretch goal — schedule for v1.1+ | ➖ |
| Apple Watch / macOS / visionOS apps | Post-MVP | ➖ |
| Receipt OCR / VisionKit | V2 | ➖ |
| Bank linking (Plaid) | V2 | ➖ |
| Multi-currency | V2 | ➖ |
| In-app payment processing | Scope guard — deeplinks only | ✂︎ |

---

## 18 · Backend (shared with RN — no parity work needed)

These remain unchanged. Listed here only so we don't accidentally re-port them.

| Item | Status | Notes |
|---|---|---|
| Supabase migrations `supabase/migrations/*.sql` | ☑ (existing) | Source of truth — never edit applied migrations |
| `process-recurring-bills` Edge Function | ☑ (existing) | Known issue: monthly overflow. See migration plan open question |
| `send-settle-reminder` Edge Function | ☑ (existing) | |
| RPCs: `create_household`, `join_household_by_token`, `rotate_invite_token`, `settle_pair`, `complete_move_out`, `close_and_open_cycle` | ☑ (existing) | |
| `settlement-pdfs` storage bucket + RLS | ☑ (existing) | |

---

## How to update this file

When you finish a row:

1. Flip the status symbol from ☐ / ◐ → ☑.
2. Fill the **Owning file(s)** column with the actual paths.
3. If tests are required (Domain rows), tick the **Tests** column too.
4. Bump the **Last updated** date at the top.
5. Commit alongside the feature.

When you discover a missing row, add it under the right section — don't keep
parity work in your head.
