# Homesplit iOS — Architecture

> Read this first. Every other iOS doc assumes you know the layering described here.

---

## Goals

- **Ship fast.** Solo dev MVP. No abstractions that pay off only in year two.
- **Correct money math.** `Domain/` has no UI dependency and is 100% unit-tested.
- **Feature parity** with the React Native build. Same Supabase backend, same RLS,
  same RPCs, same user-visible flows.
- **Native feel.** Follow HIG. Don't port Android idioms that RN forced.

---

## Layers

Strict top-down imports. A lower layer never knows about a higher one.

```
┌───────────────────────────────────────────────────────┐
│ Features (SwiftUI views + @Observable view models)    │   depends on ↓
├───────────────────────────────────────────────────────┤
│ Components + DesignSystem (reusable UI)               │   depends on ↓
├───────────────────────────────────────────────────────┤
│ Core (Supabase, RevenueCat, Notifications, Keychain)  │   depends on ↓
├───────────────────────────────────────────────────────┤
│ Domain (pure Swift: models, money math, rules)        │   no imports outside Foundation
└───────────────────────────────────────────────────────┘
```

- `Domain/` imports only `Foundation`. Compiles on Linux / CLI. This is what keeps
  the money-math tests fast and the rules easy to reason about.
- `Core/` may import third-party SDKs (`Supabase`, `RevenueCat`, `PostHog`, `Sentry`)
  and Apple frameworks (`Security`, `UserNotifications`). Its public API is protocols,
  not concrete types, so features can mock it in tests.
- `Features/` imports everything below it. Never imports another feature.
- `Components/` imports `DesignSystem` and `Domain` (for formatting helpers) but
  never `Core`. A reusable primitive must not know about Supabase.

---

## Data flow

```
        User gesture
             │
             ▼
   ┌──────────────────┐       ┌─────────────────────┐
   │ SwiftUI View     │──────▶│ @Observable         │
   │                  │       │ ViewModel           │
   │ (reads @Bindable │◀──────│                     │
   │  state)          │ state │ (owns Tasks, runs   │
   └──────────────────┘       │  on @MainActor)     │
                              └──────────┬──────────┘
                                         │ calls async throws
                                         ▼
                              ┌─────────────────────┐
                              │ Repository protocol │
                              │ (e.g. ExpensesRepo) │
                              └──────────┬──────────┘
                                         │ uses
                                         ▼
                              ┌─────────────────────┐
                              │ SupabaseClient      │
                              │ (PostgREST + RPC)   │
                              └─────────────────────┘
```

Repositories return **domain models**, not row DTOs. DTOs exist only inside the
Core layer for decoding.

### Why not TanStack-Query-style automatic caching?

The React Native app relies on TanStack Query's `queryClient.invalidateQueries`.
iOS doesn't need that layer: `@Observable` view models + explicit reload-on-event
covers 95% of the use cases. If cross-screen invalidation gets painful, introduce
a lightweight `Store` layer (an actor holding `@Published`-style state keyed by
household/cycle) before reaching for a full query cache.

---

## State ownership

| Scope | Where it lives | Example |
|---|---|---|
| App session (auth user + active household) | `AppSession: @Observable @MainActor` injected via `@Environment` | `session.currentMember`, `session.householdID` |
| Per-screen state | The screen's view model | `AddExpenseViewModel.amount`, `.paidBy` |
| Cross-screen cache (current cycle, members) | Repositories with an actor-wrapped cache, invalidated on known events (add-expense, settle, move-out) | `MembersRepository.activeMembers(forHousehold:)` |
| Global UI state (toasts) | A small `ToastCenter: @Observable` object in `AppEnvironment` | `toastCenter.show(.success("Saved"))` |
| Dev-only impersonation | `DevOverrides: @Observable` (only compiled under `#if DEBUG`) | `overrides.impersonatedMemberID` |

Avoid `@EnvironmentObject` for most state. `@Environment(\.appSession)` gives the
same ergonomics without the pre-iOS-17 boilerplate.

---

## Concurrency model

- **View models** are `@MainActor @Observable`. They own `Task`s they start; the
  view cancels the task in `.task` / `.onDisappear`.
- **Repositories** are _not_ main-actor. They are plain `actor`s or `struct`s with
  async methods. They hop to the main actor only if they need to mutate UI state
  directly (prefer returning values instead).
- **Strict concurrency** is on. Don't pass non-`Sendable` types across actor
  boundaries. DTOs, domain models, and enums should be `Sendable`.
- Long work runs in a child `Task`. Cancellation is honored: check
  `Task.checkCancellation()` between async hops in loops.

---

## Navigation

- Each tab owns a `NavigationStack` with its own `NavigationPath`. Paths store
  Hashable route values (`enum HomeRoute`, `enum ExpenseRoute`, …) rather than
  raw IDs so push/replace/back behaves predictably.
- Sheets use SwiftUI's `.sheet(item:)` with an `Identifiable` route. No nested
  `NavigationView` inside a sheet — sheets have their own root `NavigationStack`.
- Deep links enter through `HomesplitApp.onOpenURL(_:)` → a central `DeepLinkRouter`
  that resolves to a tab + path mutation. Never call view models directly from the
  scene.

```swift
// sketch
enum DeepLink {
    case joinHousehold(token: String)
    case authCallback(accessToken: String, refreshToken: String)
}

struct DeepLinkRouter {
    func handle(_ url: URL, in session: AppSession) async { … }
}
```

---

## Auth lifecycle

1. `HomesplitApp.init` builds a `SupabaseClient` configured with a Keychain-backed
   `AuthLocalStorage`.
2. `AppSession.initialize()` calls `auth.session` to restore a persisted session.
3. It subscribes to `auth.authStateChanges` — on sign-in it loads the current
   member and household; on sign-out it clears session state and calls
   `RevenueCat.resetIdentity()`.
4. The root view switches between `SignInView`, `CreateHouseholdView`, and
   `AppTabsView` based on `session.state`.

Magic-link flow:
1. User enters email. `auth.signInWithOTP(email:)` sends the link.
2. Tapping the link on iOS opens a universal link → scene `onOpenURL` → `AuthCallbackView`
   calls `auth.setSession(accessToken:refreshToken:)`.
3. `AppSession.authStateChanges` fires → router advances past the auth gate.

Dev bypass: a `#if DEBUG` branch in `AuthView` allows signing in as a test email
without magic link (mirrors the existing dev user in the RN build). Never compile
this code into Release.

---

## Paywall gate

The gate is a pure function on domain state:

```swift
enum PaywallTrigger {
    case thirdMember
    case thirdRecurringBill
    case moveOut
}

protocol PaywallGating {
    func allows(_ trigger: PaywallTrigger, subscription: Subscription?, memberCount: Int, billCount: Int) -> PaywallDecision
}
enum PaywallDecision { case allow, presentPaywall }
```

Views call `session.paywall.allows(...)` synchronously before mutating. RevenueCat
is consulted in the background to refresh entitlement; the source of truth for the
UI is the cached `Subscription.status` plus the RC listener.

---

## Offline posture

The RN app does not implement offline queueing. The Swift app should not either,
at MVP. All writes require a live Supabase connection and fail with a visible
error + retry. A dirty-queue / offline-first rewrite is explicitly V2.

Exception: **auth session** persists offline via Keychain and the Supabase client
will auto-refresh when connectivity returns.

---

## Repositories (what to build first)

In rough dependency order:

1. `AuthRepository` — wraps `supabase.auth`. Owns `AuthLocalStorage` (Keychain).
2. `HouseholdRepository` — current membership, create, join by token, rotate token,
   rename.
3. `MembersRepository` — active members list, impersonation in DEBUG.
4. `CyclesRepository` — open cycle for household.
5. `ExpensesRepository` — list by cycle, add, update, delete.
6. `BalancesRepository` — fetches raw splits, runs them through `Domain/Debts`.
7. `RecurringBillsRepository` — list, upsert, toggle payment, set cycle amount.
8. `SettlementsRepository` — `settle_pair` RPC, history.
9. `MoveOutRepository` — `complete_move_out` RPC, PDF upload.
10. `SubscriptionRepository` — reads `subscriptions` + RC entitlement.
11. `PushTokenRepository` — register/unregister APNs token.

Each repository exposes a protocol in `Core/Supabase/Protocols/` and a concrete
`Live` implementation. Tests get a `Fake` that returns in-memory data.

---

## Testing seams

- `Domain/` — pure Swift, tested with Swift Testing. Goal: 100% coverage.
- `Core/*Repository` — tested through an in-process fake Supabase (or against a
  local Supabase). Verifies the query shape + decoding, not the network.
- `Features/*ViewModel` — tested with a fake repository, asserting state machines
  (loading → loaded, validation errors, paywall gate firing).
- `HomesplitIOSUITests` — smoke flows only: launch, sign-in screen reachable, tab
  bar present. Not exhaustive regression.

---

## Folder map → RN source map

Where the TypeScript version lived vs. where the Swift version goes:

| RN path | Swift path |
|---|---|
| `app/_layout.tsx` | `App/HomesplitApp.swift` + `Features/Root/RootRouter.swift` |
| `app/(auth)/*` | `Features/Auth/` |
| `app/(onboarding)/*` | `Features/Onboarding/` |
| `app/(app)/_layout.tsx` | `Features/Root/AppTabsView.swift` |
| `app/(app)/index.tsx` | `Features/Dashboard/` |
| `app/(app)/expenses/*` | `Features/Expenses/` |
| `app/(app)/bills/*` | `Features/Bills/` |
| `app/(app)/household/*` | `Features/Household/` |
| `app/(app)/settle.tsx`, `balances/*` | `Features/Settle/` |
| `app/(app)/paywall.tsx` | `Features/Paywall/` |
| `hooks/*.ts` | `Core/Supabase/Repositories/*.swift` + per-feature view models |
| `lib/supabase.ts` | `Core/Supabase/SupabaseClientProvider.swift` |
| `lib/revenuecat.ts` | `Core/RevenueCat/*.swift` |
| `lib/notifications.ts` | `Core/Notifications/*.swift` |
| `stores/authStore.ts` | `App/AppSession.swift` + `Core/Supabase/AuthRepository.swift` |
| `stores/devStore.ts` | `App/DevOverrides.swift` (DEBUG only) |
| `utils/splits.ts` | `Domain/Splits/Splits.swift` |
| `utils/debts.ts` | `Domain/Debts/Debts.swift` |
| `utils/proration.ts` | `Domain/Proration/Proration.swift` |
| `utils/billFrequency.ts` | `Domain/BillFrequency/BillFrequency.swift` |
| `utils/billStatus.ts` | `Domain/BillStatus/BillStatus.swift` |
| `utils/cardState.ts` | `Domain/CardState/CardState.swift` |
| `utils/currency.ts` | `Domain/Money/Money.swift` |
| `utils/deeplinks.ts` | `Domain/Deeplinks/Deeplinks.swift` |
| `types/database.ts` | `Domain/Models/*.swift` + `Core/Supabase/DTOs/*.swift` |

The folder-map + per-feature status is the backbone of `IOS_MIGRATION.md`.
