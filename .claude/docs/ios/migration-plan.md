# Homesplit iOS — Migration Plan

> Step-by-step plan for rebuilding the React Native / Expo app as a native iOS
> app in Swift / SwiftUI. Feature parity is the bar. **Live feature status lives
> in `IOS_MIGRATION.md` at the repo root** — this doc is the strategy and
> ordering; `IOS_MIGRATION.md` is the checklist.

---

## Guiding principles

1. **Backend stays put.** Reuse the existing Supabase project, schema, RLS, RPCs,
   and Edge Functions. No schema migrations are required for parity. If the SQL
   needs to change later, it changes for both clients.
2. **Port domain logic first.** `utils/*.ts` becomes `Domain/*.swift` with line-by-
   line parity and 100% tests. No UI work starts until the domain tests are
   green.
3. **Feature-complete one vertical at a time.** Auth → onboarding → dashboard →
   expenses → bills → household → settle → paywall. Finish a slice before
   starting the next.
4. **No RN ↔ Swift interop.** The iOS build ignores the TypeScript source at
   runtime. The TS source is a behavior spec and is deleted once the iOS app
   ships.
5. **Track progress in one place.** Update `IOS_MIGRATION.md` when a feature
   lands, not at the end of a phase.

---

## Phases

### Phase 0 — bootstrap (≈ 1 day)

- Create `HomesplitIOS.xcodeproj` (iOS 17.0 min, iPhone only, SwiftUI App
  lifecycle).
- Add SPM dependencies: `supabase-swift`, `RevenueCat`, `RevenueCatUI`,
  `posthog-ios`, `sentry-cocoa`.
- Add xcconfig files (`Config.Debug-Dev.xcconfig`, etc.) and a
  `Config.Example.xcconfig` to commit.
- Add `Configuration.swift`, stub `AppSession`, stub root scene that shows
  "Hello world" and reads from Configuration.
- Add a Swift Testing target (`HomesplitIOSTests`).
- CI: run `xcodebuild test` on PR via GitHub Actions (macOS runner).

**Exit criteria:** `xcodebuild build` succeeds for all 3 configurations;
`xcodebuild test` passes an empty test.

### Phase 1 — Domain port (≈ 2 days)

Port, one file at a time, each with its matching test file:

- `utils/currency.ts` → `Domain/Money/Money.swift`
- `utils/splits.ts` → `Domain/Splits/Splits.swift`
- `utils/debts.ts` → `Domain/Debts/Debts.swift`
- `utils/proration.ts` → `Domain/Proration/Proration.swift`
- `utils/billFrequency.ts` → `Domain/BillFrequency/BillFrequency.swift`
- `utils/billStatus.ts` → `Domain/BillStatus/BillStatus.swift`
- `utils/cardState.ts` → `Domain/CardState/CardState.swift`
- `utils/deeplinks.ts` → `Domain/Deeplinks/Deeplinks.swift`

Also define the `Domain/Models/*` (Household, Member, Expense, ExpenseSplit,
RecurringBill, BillingCycle, Settlement, MoveOut, Subscription) and
`Domain/Enums/*`.

**Exit criteria:** every `utils/*.test.ts` has a Swift Testing equivalent that
passes. Coverage ≥ 95% on `Domain/`.

### Phase 2 — Core plumbing (≈ 2 days)

- `Core/Supabase/SupabaseClientProvider.swift`
- `Core/Supabase/KeychainAuthStorage.swift`
- `Core/Supabase/Repositories/` — protocols + live implementations for
  `Auth`, `Households`, `Members`, `Cycles`.
- `Core/RevenueCat/RevenueCatService.swift` (configure + identify + entitlement
  check).
- `Core/Notifications/NotificationsService.swift` — permission, token
  registration, upsert to `push_tokens`.
- `App/AppSession.swift` — wires repositories, observes auth changes.

**Exit criteria:** launching the app and signing in via magic link succeeds
(dev project); app reads current member + household and shows a debug
"signed in as X" screen.

### Phase 3 — Auth + onboarding (≈ 2 days)

- `Features/Auth/SignInView.swift` — email-entry form, magic-link send, dev
  bypass (`#if DEBUG`).
- `Features/Auth/AuthCallbackView.swift` — handles the universal-link return.
- `Features/Onboarding/CreateHouseholdView.swift`.
- `Features/Onboarding/JoinHouseholdView.swift` (deep link `/join/{token}`).
- Root router decides between auth / onboarding / tabs based on `AppSession`.

**Exit criteria:** you can sign in, create a household, and see an empty tab
bar. Deep-linking a valid invite from Messages joins the household and lands on
the dashboard.

### Phase 4 — Dashboard + Expenses (≈ 4 days)

- `Features/Dashboard/DashboardView.swift` — balances, stat cards, "you owe"
  rows, "bills due" section, recent transactions, FAB-equivalent add.
- `Features/Expenses/ExpensesListView.swift` — filter chips, sort, pull-to-
  refresh, swipe actions.
- `Features/Expenses/AddExpenseView.swift` — sheet with amount, description,
  category, paid-by, split toggle, optional due date.
- `Features/Expenses/ExpenseDetailView.swift` — view/edit modes, mark-paid,
  delete.
- Repositories: `ExpensesRepository`, `BalancesRepository`, `SettlementsRepository`.

**Exit criteria:** full CRUD on expenses; dashboard reflects the changes
immediately; payer self-split rule holds in every consumer; balances screen
(still stub) shows the right raw debts.

### Phase 5 — Bills (≈ 3 days)

- `Features/Bills/BillsListView.swift` — recurring bills with "paid this cycle"
  indicator.
- `Features/Bills/BillFormView.swift` — create/edit with frequency, amount or
  variable, split type, excluded members, custom shares.
- `Features/Bills/BillDetailView.swift` — cycle amount override, mark-paid
  toggle, delete.
- Repositories: `RecurringBillsRepository`,
  `BillCyclePaymentsRepository`, `BillCycleAmountsRepository`.

**Exit criteria:** create a bill, see it on the list, mark paid, untoggle, set a
cycle override. Verified against the server-side advance trigger by simulating
"all members paid" and checking `next_due_date` moved.

### Phase 6 — Settle up + balance breakdown (≈ 2 days)

- `Features/Settle/SettleView.swift` — net pairwise debts, "Pay" and "Mark
  paid" actions.
- `Features/Settle/BalanceBreakdownView.swift` — per-member breakdown for the
  current cycle.
- Venmo / Cash App URL handoff via `UIApplication.open(_:)`.

**Exit criteria:** settle-up with `settle_pair` RPC clears the UI debt; Venmo
deep link opens the Venmo app pre-filled.

### Phase 7 — Household management (≈ 3 days)

- `Features/Household/HouseholdView.swift` — member list, invite, categories,
  move-out, settings, sign-out.
- `Features/Household/InviteView.swift` — copy + share + rotate invite URL.
- `Features/Household/CategoriesView.swift` — customize default categories.
- `Features/Household/SettingsView.swift` — rename household / self; dev
  reset section under `#if DEBUG`.

**Exit criteria:** invite a second device, customize categories, rename
household.

### Phase 8 — Move-out (≈ 3 days)

- `Features/Household/MoveOutView.swift` — multi-step (pick → review → done).
- Integrate `complete_move_out` RPC.
- PDF generation with `PDFKit` and upload to `settlement-pdfs` bucket.
- Paywall gate at flow start.

**Exit criteria:** run a real move-out on the dev database. The PDF matches the
RN layout in `docs/patterns.md`. Departing member's `left_at` is set; splits
are prorated.

### Phase 9 — Paywall + RevenueCat (≈ 2 days)

- `Features/Paywall/PaywallView.swift` — RevenueCatUI paywall when available,
  fallback placeholder otherwise.
- Paywall gate enforcement in Bills (3rd+), Household (3rd+ member invite),
  Move-out flow.
- Identify RC on sign-in with `household:{id}`; reset on sign-out.

**Exit criteria:** sandbox purchase in TestFlight flips the entitlement and
unblocks the three gates in one session.

### Phase 10 — Polish + release prep (≈ 2–3 days)

- App icon, launch screen.
- Dynamic Type passes, Dark Mode passes, accessibility audit (VoiceOver on the
  dashboard, settle, add-expense).
- PostHog event wiring.
- Sentry DSN + environment.
- TestFlight build (internal), then external testers.
- App Store Connect listing, privacy manifest
  (`PrivacyInfo.xcprivacy`), screenshots.

**Exit criteria:** `IOS_MIGRATION.md` is entirely in the "Done" column.
TestFlight external review passes. Ready to submit to App Store review.

---

## Parity rules

- Every **user-visible screen** in the RN build must exist in the iOS build with
  at least equivalent capability. Track on a row-by-row basis in
  `IOS_MIGRATION.md`.
- Every **user-visible string** should match the RN build until localization
  work, so users bouncing between platforms see familiar wording.
- Every **business rule** (payer self-split, paywall triggers, proration,
  split sums) is expressed once in `Domain/` and reused everywhere.
- **Error messages** use the canonical set in `docs/ios/ui-ux.md`.

---

## Deliberate differences from the RN build

These are places where the Swift version intentionally differs:

- **Bottom sheets** use SwiftUI `.sheet` with `.presentationDetents`, not
  `@gorhom/bottom-sheet`.
- **Haptics** use `UIImpactFeedbackGenerator` / `UINotificationFeedbackGenerator`
  directly — no `expo-haptics` bridge.
- **Session storage** uses Keychain, not `expo-secure-store`.
- **Typography** prefers SwiftUI semantic styles (`.title2`, `.body`) so Dynamic
  Type scales without work. The RN custom scale maps 1:1 but is only used for
  fine adjustments.
- **No web target.** The RN build ships a web version behind
  `react-native-web`. The iOS rewrite is iPhone-only.

---

## Decommissioning the React Native source

Once `IOS_MIGRATION.md` is fully green and the iOS app has shipped to production:

1. Tag the repo `legacy-rn-v1` at the last RN commit.
2. Move the TS source to a frozen branch `legacy/react-native`.
3. Delete the RN source from `main`: `app/`, `components/`, `hooks/`,
   `stores/`, `utils/`, `lib/`, `constants/`, `types/`, `package.json`,
   `package-lock.json`, `app.json`, `eas.json`, `jest.config.js`,
   `babel.config.js`, `tsconfig.json`.
4. Keep `supabase/` (shared backend).
5. Update `README.md` to cover only the iOS workflow.
6. Update the root `CLAUDE.md` pointer to reflect the single-platform repo.

Until then, both trees coexist. Don't extend the RN source — all bug fixes land
in both platforms via the shared Supabase layer; client-side fixes go in the iOS
code.

---

## Open questions to resolve during the migration

- **RevenueCat webhook.** The RN repo has no webhook Edge Function. Do we add
  one during Phase 9 (Supabase function writes `subscriptions`) or call
  `Purchases.customerInfo()` on every cold start and upsert from the client via
  an RPC?
- **Month-overflow unification.** The Edge Function `process-recurring-bills`
  uses `Date.setUTCMonth(+1)` (overflows), while migration 014's trigger uses
  end-of-month clamping. Swift `BillFrequency` matches the trigger. Decide
  before Phase 5 whether to fix the Edge Function or leave it.
- **Widgets / Live Activities.** Stretch goals — book during Phase 10 only if
  time allows.
- **iPad support.** Out of scope for V1. Revisit post-launch.

---

*Update this plan as scope changes. Update `IOS_MIGRATION.md` as features land.*
