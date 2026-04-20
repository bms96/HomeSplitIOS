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

**Last updated:** 2026-04-20 (Phase 1 domain port complete · Phase 2 Supabase/Keychain/Households shipped · Phase 3 auth+onboarding wired · Phase 4a expenses repo+list+add shipped · Phase 4b balances repo + Home dashboard cards + "You owe" mark-paid shipped · Phase 4c expense detail/edit/delete + row-tap navigation shipped · Phase 5 recurring bills repo + list + add/edit form + detail view with cycle-amount override & mark-paid shipped · Phase 6 settle up + balance breakdown + Venmo/Cash App handoff shipped)
**Repo branch:** `main`

---

## 0 · Phase rollup

| Phase | Status | Notes |
|---|---|---|
| 0 — Bootstrap (Xcode project, SPM, CI) | ◐ | Xcode project generated via XcodeGen; SPM packages resolved; CI not yet wired |
| 1 — Domain port (`utils/*` → `Domain/*`) | ☑ | 174 tests / 31 suites passing |
| 2 — Core plumbing (Supabase, Keychain, RC, push) | ◐ | Supabase client + Keychain + households repo shipped; RC / push / analytics pending |
| 3 — Auth + onboarding | ◐ | Magic-link sign-in, RootView gate, CreateHouseholdView, stub tab bar; JoinHouseholdView pending |
| 4 — Dashboard + Expenses | ◐ | Expenses repo+list+add, BalancesRepository, HomeView cards ("You owe" / "Owed to you") and mark-paid shipped; expense detail/edit/delete + row-tap navigation shipped; bills-due card pending |
| 5 — Bills | ☑ | Repo + list + add/edit form + detail with cycle-amount override & mark-paid shipped (equal-split only; custom_pct/_amt deferred) |
| 6 — Settle + Balance breakdown | ☑ | SettleView + BalanceBreakdownView + Venmo/Cash App handoff; reuses `BalancesRepository.settlePair` |
| 7 — Household management | ☐ | |
| 8 — Move-out | ☐ | |
| 9 — Paywall + RevenueCat | ☐ | |
| 10 — Polish + release prep | ☐ | |

---

## 1 · Bootstrap & Tooling

| Item | Status | Owning file(s) | Notes |
|---|---|---|---|
| `HomesplitIOS.xcodeproj` (iOS 17 min, iPhone-only, SwiftUI App) | ☑ | `HomesplitIOS.xcodeproj` (generated) | Generated from `project.yml` via XcodeGen |
| XcodeGen spec | ☑ | `project.yml` | Run `xcodegen generate` to (re)create the xcodeproj |
| SPM dependencies: `supabase-swift`, `RevenueCat`, `RevenueCatUI`, `posthog-ios`, `sentry-cocoa` | ☑ | `project.yml` | All 11 transitive packages resolve cleanly |
| Xcconfig: `Config.Debug-Dev`, `Config.Release-Dev`, `Config.Release-Prod` + `Config.Example` | ☑ | `HomesplitIOS/SupportingFiles/` | Values still need to be filled in by the developer |
| `Configuration.swift` — Info.plist reader for env values | ☑ | `HomesplitIOS/App/Configuration.swift` | |
| Swift Testing target (`HomesplitIOSTests`) | ☑ | `HomesplitIOSTests/SmokeTests.swift` | Placeholder smoke test |
| XCUITest smoke target (`HomesplitIOSUITests`) | ☑ | `HomesplitIOSUITests/SmokeFlowTests.swift` | Placeholder smoke test |
| GitHub Actions CI (Unit plan on PR) | ☐ | `.github/workflows/ios-ci.yml` | |
| SwiftFormat / swift-format pre-commit | ☐ | `.swiftformat` | |
| Entitlements: Push, Associated Domains (`applinks:homesplit.app`) | ☑ | `HomesplitIOS/SupportingFiles/HomesplitIOS.entitlements` | |
| Info.plist: URL scheme `homesplit`, `LSApplicationQueriesSchemes` for `venmo`/`cashapp` | ☑ | `HomesplitIOS/Resources/Info.plist` | |
| Asset Catalog (AppIcon placeholder, AccentColor, LaunchBackground) | ☑ | `HomesplitIOS/Resources/Assets.xcassets` | AppIcon artwork still needed (Phase 10) |
| First verified build on a simulator | ☐ | | Blocked on iOS 26.4 simulator runtime install (8.49 GB) |

---

## 2 · Domain (`utils/*.ts` → `Domain/*.swift`)

P1 ship-blocker: 100 % test coverage on every row in this section.

| RN source | iOS target | Status | Owning file(s) | Tests | Notes |
|---|---|---|---|---|---|
| `utils/currency.ts` | `Domain/Money/Money.swift` | ☑ | `Domain/Money/Money.swift` | ☑ | Decimal parse + `formatted(.currency(...))` + half-away-from-zero rounding |
| `utils/splits.ts` | `Domain/Splits/Splits.swift` | ☑ | `Domain/Splits/Splits.swift` | ☑ | Equal / pct / exact + first-member-absorbs-remainder |
| `utils/debts.ts` | `Domain/Debts/Debts.swift` | ☑ | `Domain/Debts/Debts.swift` | ☑ | Greedy simplify, pairwise, payer-self-split skip |
| `utils/proration.ts` | `Domain/Proration/Proration.swift` | ☑ | `Domain/Proration/Proration.swift` | ☑ | Days-present, household-tz-aware |
| `utils/billFrequency.ts` | `Domain/BillFrequency/BillFrequency.swift` | ☑ | `Domain/BillFrequency/BillFrequencyAdvance.swift` | ☑ | End-of-month clamp matches migration 014 |
| `utils/billStatus.ts` | `Domain/BillStatus/BillStatus.swift` | ☑ | `Domain/BillStatus/BillStatus.swift` | ☑ | `isFullyPaid`, `isOverdue` predicates |
| `utils/cardState.ts` | `Domain/CardState/CardState.swift` | ☑ | `Domain/CardState/CardState.swift` | ☑ | Tone enum for dashboard cards |
| `utils/deeplinks.ts` | `Domain/Deeplinks/Deeplinks.swift` | ☑ | `Domain/Deeplinks/Deeplinks.swift` | ☑ | Venmo / Cash App / invite URL builders |
| Domain models | `Domain/Models/*` | ☑ | `Domain/Models/*` | n/a | Household, Member, Expense, ExpenseSplit, RecurringBill, BillingCycle, Settlement, MoveOut, Subscription |
| Domain enums | `Domain/Enums/*` | ☑ | `Domain/Enums/*` | n/a | ExpenseCategory, SettlementMethod, BillFrequency, SplitType, SubscriptionStatus |

---

## 3 · Core plumbing

| Capability | RN reference | iOS target | Status | Owning file(s) | Notes |
|---|---|---|---|---|---|
| Supabase client singleton + protocol | `lib/supabase.ts` | `Core/Supabase/SupabaseClientProvider.swift` | ☑ | `Core/Supabase/SupabaseClientProvider.swift`, `SupabaseClientProviding.swift` | Lazy client; safe boot when xcconfig empty |
| Keychain auth storage | Expo SecureStore in `lib/supabase.ts` | `Core/Persistence/KeychainAuthStorage.swift` | ☑ | `Core/Persistence/KeychainAuthStorage.swift` | `AuthLocalStorage` adapter, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` |
| `AppSession` (auth-state observer) | `stores/authStore.ts` | `App/AppSession.swift` | ☑ | `Core/Auth/AuthSession.swift`, `Core/Household/HouseholdSession.swift` | `@Observable`, `authStateChanges` listener |
| Auth repository | `useAuth.ts` | `Core/Supabase/Repositories/AuthRepository.swift` | ☑ | (folded into `AuthSession`) | Magic-link send, sign-out, `handleAuthCallback` |
| Households repository | `hooks/useHousehold.ts` | `Core/Supabase/Repositories/HouseholdsRepository.swift` | ☑ | `Core/Repositories/HouseholdRepository.swift` | `create_household`, `join_household_by_token`, `rotate_invite_token` |
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
| `app/(auth)/sign-in.tsx` | `Features/Auth/SignInView.swift` | ☑ | `Features/Auth/SignInView.swift` | Magic-link email entry; dev bypass pending |
| Magic-link callback handler | `Features/Auth/AuthCallbackView.swift` | ☑ | `App/HomesplitApp.swift` (`.onOpenURL`), `Core/Auth/AuthSession.handleAuthCallback` | Routed inline from root scene |
| `app/(auth)/join/[token].tsx` | `Features/Onboarding/JoinHouseholdView.swift` | ☐ | | Universal link `https://homesplit.app/join/{token}` |
| First-run: create household | `Features/Onboarding/CreateHouseholdView.swift` | ☑ | `Features/Onboarding/CreateHouseholdView.swift` | Calls `create_household` RPC, refreshes `HouseholdSession` |
| Root router (auth / onboarding / tabs) | `App/HomesplitApp.swift` + `App/RootRouter.swift` | ☑ | `App/RootView.swift` | Routes between SignInView / CreateHouseholdView / MainTabView |

---

## 5 · Tabs & Dashboard

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| Tab bar (Home / Expenses / Bills / Household) | `App/RootTabView.swift` | ◐ | `Features/Dashboard/MainTabView.swift` | 4 tabs wired; badges not yet |
| Dashboard screen | `Features/Dashboard/DashboardView.swift` | ◐ | `Features/Dashboard/HomeView.swift`, `HomeViewModel.swift` | You owe / Owed to you cards + "You owe" section with mark-paid; bills-due card deferred to Phase 5 |
| Dashboard stat cards | `Components/Cards/BalanceCard.swift`, `Components/Cards/StatCard.swift` | ◐ | (inline in `HomeView.swift`) | Tones from `Domain/CardState/`; extract to Components when a 3rd consumer appears |
| Recent transactions list | `Features/Dashboard/RecentTransactionsSection.swift` | ◐ | (inline "You owe" list in `HomeView.swift`) | Top 5 unpaid expenses where viewer is debtor; full recent-transactions list + settlements pending |
| Add-expense FAB / toolbar entry | (folded into `DashboardView` toolbar) | ◐ | `Features/Expenses/ExpensesView.swift` | `+` toolbar lives on Expenses tab; Home FAB entry point pending |

---

## 6 · Expenses

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/expenses/index.tsx` | `Features/Expenses/ExpensesListView.swift` | ◐ | `Features/Expenses/ExpensesView.swift`, `ExpensesListViewModel.swift` | Basic list + pull-to-refresh; filter chips / swipe actions pending |
| `app/(app)/expenses/add.tsx` (sheet) | `Features/Expenses/AddExpenseView.swift` | ☑ | `Features/Expenses/AddExpenseView.swift` | Equal-split only at MVP; presented from Expenses toolbar |
| Expense detail / edit | `Features/Expenses/ExpenseDetailView.swift` | ☑ | `Features/Expenses/ExpenseDetailView.swift`, `ExpenseDetailViewModel.swift`, `EditExpenseView.swift`, `EditExpenseViewModel.swift` | Detail w/ splits + mark-paid; edit sheet gated on no-settled-splits; delete via confirmationDialog; row-tap wired in `ExpensesView` via `NavigationLink(value:)` |
| ExpensesRepository | `Core/Supabase/Repositories/ExpensesRepository.swift` | ☑ | `Core/Repositories/ExpensesRepository.swift` | `currentCycle`, `list`, `detail`, `create`, `update`, `delete`, `markSplitPaid` |
| BalancesRepository | `Core/Supabase/Repositories/BalancesRepository.swift` | ☑ | `Core/Repositories/BalancesRepository.swift` | `balances`, `carryover`, `settlePair`; results run through `Domain/Debts/` |
| Category preferences | `Core/Supabase/Repositories/CategoryPreferencesRepository.swift` | ☐ | | Hidden + custom labels |
| Add-expense view model | `Features/Expenses/AddExpenseViewModel.swift` | ☑ | `Features/Expenses/AddExpenseViewModel.swift` | `@Observable`; `canSubmit` gate + equal-split submit |

---

## 7 · Bills

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/bills/index.tsx` | `Features/Bills/BillsView.swift` | ☑ | `Features/Bills/BillsView.swift`, `Features/Bills/BillsListViewModel.swift` | Paid-count per bill + "you paid" badge + paused/overdue labels |
| `app/(app)/bills/[id].tsx` (create/edit) | `Features/Bills/BillFormView.swift` | ☑ | `Features/Bills/BillFormView.swift`, `Features/Bills/BillFormViewModel.swift` | Name/amount(nullable)/frequency/date/active/included-members; equal-split only (custom_pct/_amt deferred) |
| Bill detail | `Features/Bills/BillDetailView.swift` | ☑ | `Features/Bills/BillDetailView.swift`, `Features/Bills/BillDetailViewModel.swift` | Cycle-amount override entry, current-member mark-paid toggle, per-member share display, edit-lock when any member has paid |
| RecurringBillsRepository | `Core/Repositories/RecurringBillsRepository.swift` | ☑ | `Core/Repositories/RecurringBillsRepository.swift` | Bills + `bill_cycle_amounts` + `bill_cycle_payments` collapsed into one repo to match the RN hooks module |
| Variable-bill mark-paid gate | (in `BillDetailViewModel`) | ☑ | `Features/Bills/BillDetailViewModel.swift` | Client-side gate mirrors `bcp_enforce_amount` — toggling disabled until `bill_cycle_amounts` row exists |

---

## 8 · Settle Up & Balance Breakdown

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/settle.tsx` | `Features/Settle/SettleView.swift` | ☑ | `HomesplitIOS/Features/Settle/SettleView.swift`, `SettleViewModel.swift` | Pairwise debts for "Your balances" (so Mark paid maps to real splits), simplified for "Between roommates" |
| Per-member breakdown | `Features/Settle/BalanceBreakdownView.swift` | ☑ | `HomesplitIOS/Features/Settle/BalanceBreakdownView.swift`, `BalanceBreakdownViewModel.swift` | Current cycle; net card + you-owe/they-owe lists + math card |
| `settle_pair` RPC wrapper | `SettlementsRepository.settlePair(...)` | ☑ | `HomesplitIOS/Core/Repositories/BalancesRepository.swift` | Reused existing `BalancesRepository.settlePair` rather than adding a dedicated repo |
| Venmo / Cash App handoff | `UIApplication.open(_:)` from `Domain/Deeplinks/` | ☑ | `HomesplitIOS/Features/Settle/SettleView.swift` | Confirmation dialog → `Deeplinks.buildVenmoUrl` / `buildCashAppUrl`; falls back to error message if app unavailable |

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
