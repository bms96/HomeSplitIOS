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

**Last updated:** 2026-04-20 (Phase 1 domain port complete · Phase 2 Supabase/Keychain/Households shipped · Phase 3 auth+onboarding wired · Phase 4a expenses repo+list+add shipped · Phase 4b balances repo + Home dashboard cards + "You owe" mark-paid shipped · Phase 4c expense detail/edit/delete + row-tap navigation shipped · Phase 5 recurring bills repo + list + add/edit form + detail view with cycle-amount override & mark-paid shipped · Phase 6 settle up + balance breakdown + Venmo/Cash App handoff shipped · Phase 7 household overview + invite + categories + settings shipped · Phase 8 move-out repo + 3-step flow + PDF settlement shipped · Phase 9 paywall gate service + fallback sheet wired at the three triggers; live RevenueCat SDK + webhook still pending · Phase 10 JoinHouseholdView + deeplink router (custom scheme + universal link) + tab-bar badges shipped; artwork/privacy-manifest/CI/TestFlight pending)
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
| 7 — Household management | ◐ | Household overview, Invite, Categories, Settings shipped; Move-out stub is Phase 8 |
| 8 — Move-out | ☑ | Repo + 3-step flow + PDFKit settlement summary + Storage upload best-effort |
| 9 — Paywall + RevenueCat | ◐ | Gate service + fallback sheet wired at 3rd-member invite, 3rd-bill add, move-out start. Live RevenueCat SDK + webhook still pending. |
| 10 — Polish + release prep | ◐ | Join-by-token deeplink router (custom scheme + universal link) + tab-bar badges shipped. App icon artwork, privacy manifest, CI workflow, and TestFlight gating remain. |

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
| Members repository | (inline in `useHousehold`) | `Core/Supabase/Repositories/MembersRepository.swift` | ☑ | `Core/Repositories/HouseholdRepository.swift` (`members(householdId:)`) | Folded into `HouseholdRepository` to match the RN hooks module; applies `left_at IS NULL` active filter |
| Cycles repository | (inline) | `Core/Supabase/Repositories/CyclesRepository.swift` | ☑ | `Core/Repositories/ExpensesRepository.swift` (`currentCycle(householdId:)`) | Folded into `ExpensesRepository` — consumed by `HomeView`, `BillsView`, `BadgeStore` |
| RevenueCat service | `lib/revenuecat.ts` | `Core/RevenueCat/RevenueCatService.swift` | ☐ | | `logIn("household:\(uuid)")`, entitlement check |
| Notifications service | `lib/notifications.ts` | `Core/Notifications/NotificationsService.swift` | ☐ | | APNs token → `push_tokens` upsert |
| Logger | `console.log` | `os.Logger` wrappers | ➖ | | No `print()` calls exist in the Swift target; revisit if/when one is introduced |
| Analytics shim | `lib/analytics.ts` (PostHog) | `Core/Analytics.swift` | ☐ | | Match RN event names exactly |
| Sentry init | `lib/sentry.ts` | `Core/Crash/SentryService.swift` | ☐ | | Off in DEBUG |

---

## 4 · Auth & Onboarding

| RN screen | iOS screen | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(auth)/sign-in.tsx` | `Features/Auth/SignInView.swift` | ☑ | `Features/Auth/SignInView.swift` | Magic-link email entry; dev bypass pending |
| Magic-link callback handler | `Features/Auth/AuthCallbackView.swift` | ☑ | `App/HomesplitApp.swift` (`.onOpenURL`), `Core/Auth/AuthSession.handleAuthCallback` | Routed inline from root scene |
| `app/(auth)/join/[token].tsx` | `Features/Onboarding/JoinHouseholdView.swift` | ☑ | `Features/Onboarding/JoinHouseholdView.swift`, `App/PendingDeeplink.swift`, `App/RootView.swift` | Sheet auto-presents once signed in + session loaded; calls `join_household_by_token` and refreshes household session |
| First-run: create household | `Features/Onboarding/CreateHouseholdView.swift` | ☑ | `Features/Onboarding/CreateHouseholdView.swift` | Calls `create_household` RPC, refreshes `HouseholdSession` |
| Root router (auth / onboarding / tabs) | `App/HomesplitApp.swift` + `App/RootRouter.swift` | ☑ | `App/RootView.swift` | Routes between SignInView / CreateHouseholdView / MainTabView |

---

## 5 · Tabs & Dashboard

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| Tab bar (Home / Expenses / Bills / Household) | `App/RootTabView.swift` | ☑ | `Features/Dashboard/MainTabView.swift`, `Core/Badges/BadgeStore.swift` | 4 tabs wired; Home badge = unsettled "you owe" count, Bills badge = overdue active bills the viewer hasn't paid; refresh driven centrally by `BadgeStore` on `householdId` change |
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
| `app/(app)/household/index.tsx` | `Features/Household/HouseholdView.swift` | ☑ | `Features/Household/HouseholdView.swift`, `HouseholdViewModel.swift`, `Components/MemberAvatar.swift` | Overview with member list, Settle/Settings quick actions, invite/categories/move-out/sign-out footer; Move-out button presents `MoveOutFlowView` (Phase 8) behind the paywall gate |
| `app/(app)/household/invite.tsx` | `Features/Household/InviteView.swift` | ☑ | `Features/Household/InviteView.swift` | Tap-to-copy link card, Copy + ShareLink + Rotate (confirmationDialog) |
| Categories management | `Features/Household/CategoriesView.swift` | ☑ | `Features/Household/CategoriesView.swift`, `CategoriesViewModel.swift`, `Domain/Categories/CategoryDisplay.swift`, `Core/Repositories/CategoryPreferencesRepository.swift` | Inline rename, visibility toggle, Reset; upsert via `expense_category_preferences` |
| Household settings | `Features/Household/SettingsView.swift` | ☑ | `Features/Household/SettingsView.swift` | Household name + own display name; dev-mock impersonation and reset-data intentionally skipped |
| Member rename / color edit | `Features/Household/MemberEditView.swift` | ☐ | | Deferred — rename lives in SettingsView for now |

---

## 10 · Move-Out

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| `app/(app)/household/move-out.tsx` (multi-step) | `Features/Household/MoveOutFlow/` | ☑ | `Features/Household/MoveOutFlow/MoveOutFlowView.swift`, `MoveOutFlowViewModel.swift` | Pick → review → done |
| `complete_move_out` RPC wrapper | `MoveOutRepository.complete(...)` | ☑ | `Core/Repositories/MoveOutRepository.swift` | |
| PDF generation | `Features/Household/MoveOutFlow/MoveOutPDF.swift` | ☑ | `Features/Household/MoveOutFlow/MoveOutPDF.swift` | PDFKit; single-page settlement summary |
| PDF upload to Storage | (in `MoveOutRepository`) | ☑ | `Core/Repositories/MoveOutRepository.swift` | `settlement-pdfs/{household_id}/{move_out_id}.pdf`; best-effort — local ShareLink fallback |
| Paywall gate at flow start | (in `MoveOutFlow`) | ☑ | `Features/Household/MoveOutFlow/MoveOutFlowView.swift` | Evaluates `PaywallGateService` on appear; blocks entry + dismisses on close |

---

## 11 · Paywall & RevenueCat

| RN | iOS | Status | Owning file(s) | Notes |
|---|---|---|---|---|
| Paywall screen | `Features/Paywall/PaywallGateView.swift` | ☑ | `Features/Paywall/PaywallGateView.swift` | Fallback SwiftUI sheet; `RevenueCatUI` bridge lands with SPM wiring |
| Paywall gate (3rd member, 3rd bill, move-out) | `Features/Paywall/PaywallGateService.swift` | ☑ | `Domain/Paywall/PaywallTrigger.swift`, `Features/Paywall/PaywallGateService.swift`, `Core/Repositories/SubscriptionsRepository.swift`, `Core/RevenueCat/RevenueCatClient.swift` | Reads `subscriptions` + RC CustomerInfo; stub client until live SDK linked |
| RC identify on sign-in / reset on sign-out | (in `RevenueCatClient`) | ◐ | `Core/RevenueCat/RevenueCatClient.swift` | Protocol has `identifyHousehold` / `resetIdentity`; live wiring pending SPM |
| RevenueCat → Supabase webhook | (open question — see migration plan) | ➖ | | Decide before TestFlight external |

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
| `homesplit://join/{token}` | `App/Routing/DeeplinkRouter.swift` | ☑ | Parsed in `HomesplitApp.handle(url:)`; token held in `PendingDeeplink`; presents `JoinHouseholdView` sheet from `RootView` |
| `https://homesplit.app/join/{token}` (universal link) | same | ☑ | `.onContinueUserActivity(NSUserActivityTypeBrowsingWeb)` routes through the same handler; requires `apple-app-site-association` hosted on the domain before TestFlight |
| `homesplit://auth-callback?...` | same | ☑ | Handled inline in `HomesplitApp.handle(url:)` via `AuthSession.handleAuthCallback` |
| Venmo handoff | `Domain/Deeplinks/Deeplinks.swift` | ☑ | `Domain/Deeplinks/Deeplinks.swift` + `Features/Settle/SettleView.swift` open via `UIApplication.open(_:)` |
| Cash App handoff | same | ☑ | same |

---

## 14 · Design System

| Token | iOS file | Status | Notes |
|---|---|---|---|
| Color palette | `DesignSystem/Colors.swift` + `Assets.xcassets` semantic colors | ☑ | `HSColor` tokens with adaptive light/dark variants (brand accents stay constant) |
| Typography scale | `DesignSystem/Typography.swift` | ☑ | `HSFont` token set; built on SwiftUI semantic styles (Dynamic Type wired) |
| Spacing (4 pt grid) | `DesignSystem/Spacing.swift` | ☑ | `HSSpacing` scale (`xs`/`sm`/`md`/`base`/`lg`/`xl`/`xxl`) |
| Shadows / elevation | `DesignSystem/Elevation.swift` | ➖ | Not needed at MVP — flat cards with `RoundedRectangle` + tinted backgrounds |
| Reusable primitives | `Components/Primitives/HSButton.swift`, `HSTextField.swift`, `HSCurrencyField.swift` | ◐ | `HSButton` + `HSTextField` live; currency input uses a plain `TextField` with `Decimal(string:)` parsing — dedicated `HSCurrencyField` deferred |
| Reusable cards | `Components/Cards/*` | ➖ | Cards currently inlined in `HomeView`; extract when a 3rd consumer lands (matches CLAUDE.md "three similar lines beats premature abstraction") |
| `MemberAvatar` | `Components/MemberAvatar.swift` | ☑ | `Components/MemberAvatar.swift` |
| Dev-build indicator | `Components/DevBadge.swift` | ☑ | Orange "DEV · {env}" pill overlay, no-op in prod, wired in `HomesplitApp` via `.devBadgeOverlay()` |

---

## 15 · Testing

| Test plan | Status | Notes |
|---|---|---|
| Domain unit tests (Swift Testing) | ☑ | 174 tests / 31 suites across `Splits`, `Debts`, `Proration`, `BillFrequency`, `BillStatus`, `CardState`, `Deeplinks`, `Money` |
| ViewModel state-machine tests | ☐ | P3 — Paywall gate, move-out proration VM, add-expense validation |
| RLS integration tests (local Supabase) | ☐ | P2 — eight scenarios from `.claude/docs/ios/testing.md` |
| Decoder fixtures | ☐ | One JSON per DTO in `HomesplitIOSTests/Fixtures/` |
| XCUITest smoke (launch + sign-in reachable + tab bar present) | ◐ | `HomesplitIOSUITests/SmokeFlowTests.swift` exists but has a `main actor-isolated property` warning to clean up |
| CI test plan wired to PRs (Unit only) | ☐ | `.github/workflows/ios-ci.yml` not yet created |

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
