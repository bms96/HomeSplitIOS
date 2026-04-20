# Homesplit iOS — AI Development Context

> This repo began life as a React Native + Expo clone of Homesplit. It is now being
> rebuilt as a **native iOS app in Swift / SwiftUI** with feature parity against the
> React Native original. The TypeScript source tree is kept as a behavioral spec
> reference only — do not ship it, do not extend it. New code goes in the Xcode
> project.

---

## Project Overview

**Homesplit** is a household billing and expense-splitting app built exclusively for
roommates. Not a general-purpose expense tracker. Every feature decision must pass:
"does this solve a problem specific to people who share a home?"

**Three core differentiators — never compromise:**
1. **Automated recurring bills** — set once, roll over automatically every cycle.
2. **Move-out flow** — first-class roommate departure with proration + settlement.
3. **Zero transaction limits on the free tier** — no daily caps, no ads, ever.

The Supabase backend is **shared with the React Native build** (same tables, RLS,
RPCs, Edge Functions). The iOS app is a new client against that backend — no
schema changes needed for parity.

---

## Tech Stack (iOS)

| Layer | Technology | Notes |
|---|---|---|
| Language | Swift 6 (strict concurrency) | `@MainActor` on view models; structured async/await everywhere |
| UI | SwiftUI (iOS 17+) | UIKit only where SwiftUI has gaps (share sheets, PDFKit, StoreKit UI bridges) |
| Minimum deployment | iOS 17.0 | Unlocks `@Observable`, `Observation`, `NavigationStack`, `.inspector`, `.containerRelativeFrame` |
| Navigation | `NavigationStack` + tab-scoped paths | One `NavigationPath` per tab; deep links route through the root coordinator |
| Backend client | `supabase-swift` SPM package | Auth + PostgREST + Realtime + Storage |
| Auth session store | Keychain (`AuthLocalStorage` protocol) | Replaces Expo SecureStore; never UserDefaults for tokens |
| Server state | Custom `@Observable` repositories | No SwiftData, no Core Data — Supabase is the source of truth |
| Local state | `@Observable` view models + `@Environment` | No Combine unless bridging a legacy API |
| Forms | SwiftUI + `Observable` view models | Inline validation; `Decimal`-backed money fields |
| Subscriptions | `RevenueCat` iOS SDK + `RevenueCatUI` | Household-level entitlement `pro_household` |
| Push notifications | APNs via `UNUserNotificationCenter` | Token stored in Supabase `push_tokens` with `platform = 'ios'` |
| Deeplinks | Universal Links + `homesplit://` custom scheme | Handled by scene `onOpenURL` / `onContinueUserActivity` |
| PDFs | `PDFKit` | Move-out settlement PDF generated on-device, uploaded to Supabase Storage |
| Analytics | PostHog iOS SDK | Same event names as the RN build (see `docs/ios/app-identity.md`) |
| Error tracking | Sentry iOS SDK | Off in DEBUG, on in Release |
| Package manager | Swift Package Manager | No CocoaPods; RC + Supabase + PostHog + Sentry are all SPM-ready |
| Tests | Swift Testing (primary) + XCTest (UITests) | XCUITest kept to smoke flows only |
| Formatting | SwiftFormat | Run via pre-commit hook or SPM plugin |

---

## Project Structure (target Xcode layout)

The Xcode project has not been generated yet. Follow this layout when it is:

```
HomesplitIOS.xcodeproj
HomesplitIOS/                        # App target
├── App/
│   ├── HomesplitApp.swift           # @main, root scene, deeplink routing
│   ├── AppEnvironment.swift         # Environment keys + DI container
│   └── Configuration.swift          # Config plist reader (Supabase URL/anon, RC key)
├── Features/
│   ├── Auth/                        # Sign-in, auth callback, magic-link deeplink
│   ├── Onboarding/                  # CreateHouseholdView, invite-join flow
│   ├── Dashboard/                   # Home tab: balances, bills due, recent expenses
│   ├── Expenses/                    # List, AddExpenseSheet, ExpenseDetailView
│   ├── Bills/                       # List, BillFormSheet, BillDetailView, cycle payments
│   ├── Household/                   # Members, InviteView, MoveOutFlow, SettingsView, CategoriesView
│   ├── Settle/                      # Settle-up + BalanceBreakdownView
│   └── Paywall/                     # RevenueCatUI bridge + fallback view
├── Components/                      # Reusable SwiftUI views
│   ├── Primitives/                  # HSButton, HSTextField, HSCurrencyField, HSBottomSheetModifier
│   ├── Cards/                       # BalanceCard, ExpenseCard, RecurringBillCard
│   └── MemberAvatar.swift
├── Core/
│   ├── Supabase/                    # Client, AuthStore, push-token bridge
│   ├── RevenueCat/                  # Configuration, entitlement checks, customer center
│   ├── Notifications/               # Register, handle, deep link
│   ├── Networking/                  # Any REST/edge-function helpers
│   └── Persistence/                 # KeychainAuthStorage, UserDefaults feature-flags
├── Domain/                          # Pure Swift business logic, no UI imports
│   ├── Models/                      # Household, Member, Expense, ExpenseSplit, RecurringBill, BillingCycle, Settlement, MoveOut, Subscription
│   ├── Enums/                       # ExpenseCategory, SettlementMethod, BillFrequency, SplitType
│   ├── Money/                       # Decimal helpers, formatUSD, parse from user input
│   ├── Splits/                      # calculateEqualSplits / calculatePercentSplits / calculateExactSplits
│   ├── Debts/                       # simplifyDebts, computePairwiseDebts, computeNetBalances
│   ├── Proration/                   # daysPresent, cycleTotalDays, prorateAmount
│   ├── BillFrequency/               # advanceDueDate, formatFrequency, shouldAdvanceBill
│   ├── BillStatus/                  # isBillFullyPaid, isBillEffectivelyOverdue
│   ├── CardState/                   # computeYouOwe/OwedToYou/BillsDue card tones
│   └── Deeplinks/                   # Venmo/CashApp/invite URL builders
├── DesignSystem/
│   ├── Colors.swift                 # Token enum mapped to UIColor + `.colorToken(.primary)`
│   ├── Spacing.swift                # 4pt grid constants
│   └── Typography.swift             # Font scale — prefer SwiftUI `.font(.title2)` where it maps cleanly
├── Resources/
│   ├── Assets.xcassets              # App icon, accent color, semantic asset colors
│   ├── Localizable.xcstrings        # User-facing strings (even if English-only at MVP)
│   └── Info.plist                   # URL types, background modes, APNs entitlements
└── SupportingFiles/
    └── HomesplitIOS.entitlements    # Associated Domains, Push, Keychain sharing if needed

HomesplitIOSTests/                   # Swift Testing (unit)
├── DomainTests/                     # Splits, Debts, Proration, BillFrequency — 100% coverage target
├── NetworkingTests/                 # URL building, decoding
└── Fixtures/                        # JSON snapshots from Supabase for decoder tests

HomesplitIOSUITests/                 # XCUITest (smoke only)
└── SmokeFlowTests.swift             # Launch → sign-in UI reachable → tab bar present

Packages/                            # Optional local SPM packages (if you split Domain into a lib)
└── HomesplitDomain/
```

**Folder rules:**
- `Domain/` has **zero imports of SwiftUI or UIKit** — it must compile on Linux / command-line Swift. This is what makes money math cheap to unit-test.
- `Features/` imports `Domain/`, `Core/`, `Components/`, `DesignSystem/` — never the other way around.
- No cross-imports between `Features/*` subfolders. Shared UI belongs in `Components/`.

---

## Database Schema (Reference — backend is shared)

```sql
-- Always query through RLS. Never embed the service-role key in the app.

households               (id, name, address, cycle_start_day, invite_token, timezone, created_at)
members                  (id, household_id, user_id, display_name, phone, color, joined_at, left_at)
billing_cycles           (id, household_id, start_date, end_date, closed_at)
expenses                 (id, household_id, cycle_id, paid_by_member_id, amount, description,
                          category, date, due_date, recurring_bill_id)
expense_splits           (id, expense_id, member_id, amount_owed, settled_at, settlement_id)
recurring_bills          (id, household_id, name, amount, frequency, next_due_date,
                          active, split_type, custom_splits)
bill_cycle_amounts       (id, bill_id, cycle_id, amount)                 -- per-cycle override
bill_cycle_payments      (id, bill_id, cycle_id, member_id, settled_at)  -- one per (bill, cycle, member)
settlements              (id, household_id, cycle_id, from_member_id, to_member_id,
                          amount, method, notes, settled_at)
move_outs                (id, household_id, departing_member_id, move_out_date,
                          prorated_days_present, cycle_total_days,
                          settlement_amount, settlement_id, pdf_url, completed_at)
subscriptions            (id, household_id, status, revenuecat_id, product_id, expires_at)
push_tokens              (id, user_id, token, platform, created_at, updated_at)
expense_category_preferences (household_id, category, hidden, custom_label, updated_at)
```

**Enums:** `bill_cycle_frequency` (weekly, biweekly, monthly, monthly_first, monthly_last) ·
`split_type` (equal, custom_pct, custom_amt) ·
`expense_category` (rent, utilities, groceries, household, food, transport, other) ·
`settlement_method` (venmo, cashapp, cash, other) ·
`subscription_status` (active, expired, cancelled, trial).

**Key invariants the Swift client must uphold:**
- `members.user_id` is nullable — members can be invited before they have an auth account.
- `members.left_at != nil` means they moved out — **never delete member rows**.
- `expenses.amount` is dollars-as-decimal (e.g. `47.50`) — store as `Decimal`, not `Double`.
- `recurring_bills.amount == nil` means variable — a `bill_cycle_amounts` row is required
  before any member can mark paid (server-side trigger enforces, client should also gate).
- Always filter active members with `left_at IS NULL`.
- **Payer-self-split rule:** when reading `expense_splits`, ignore rows where
  `member_id == expenses.paid_by_member_id` (they don't owe themselves). Applies everywhere
  that reads `settled_at`. See `docs/ios/bills-vs-expenses.md`.

**Full backend reference:** `docs/ios/backend-reference.md` (tables, RLS policies, RPCs,
triggers, Edge Functions).

---

## Scoped Instructions (auto-loaded by file context)

| Instruction file | Applies to | What it covers |
|---|---|---|
| `.github/instructions/swift-style.instructions.md` | `HomesplitIOS/**/*.swift` | Swift 6 concurrency, naming, error handling, observation |
| `.github/instructions/swiftui.instructions.md` | `HomesplitIOS/Features/**, HomesplitIOS/Components/**` | SwiftUI patterns, design tokens, accessibility |
| `.github/instructions/supabase-swift.instructions.md` | `HomesplitIOS/Core/Supabase/**, HomesplitIOS/Features/**` | `supabase-swift` usage, RLS, decoding |
| `.github/instructions/money-swift.instructions.md` | `HomesplitIOS/Domain/**` | `Decimal`, splits, debts, proration |
| `.github/instructions/testing-swift.instructions.md` | `HomesplitIOSTests/**, HomesplitIOSUITests/**` | Swift Testing, XCTest, fixtures |

**Full reference docs** live in `.claude/docs/ios/`:
`architecture.md`, `patterns.md`, `bills-vs-expenses.md`, `ui-ux.md`,
`testing.md`, `backend-reference.md`, `app-identity.md`, `migration-plan.md`.

The original React Native docs remain in `.claude/docs/` (non-`ios/` subdirectory) for
historical reference. Prefer the iOS versions when there is overlap.

---

## Code Patterns — Key Rules

> **Full reference:** `.claude/docs/ios/patterns.md` (Supabase client, repositories,
> view models, Observation, RevenueCat init, PDF generation, URL schemes).

Always apply:

- **Supabase client is a singleton** behind a protocol (`SupabaseClientProviding`) so tests
  can inject a fake. Never call `SupabaseClient(...)` inside a view.
- **Auth session in Keychain only** — use the `AuthLocalStorage` bridge to Keychain.
  Never store access/refresh tokens in `UserDefaults`.
- **Repositories, not ad-hoc fetches** — every Supabase query lives in a repository
  method returning `async throws -> T`. Views observe `@Observable` view models that
  call repositories.
- **Money as `Decimal`** — parse user input with `Decimal(string:locale:)`, never
  `Double(string:)`. Format with `.formatted(.currency(code: "USD"))`.
- **Splits must sum to amount exactly** — first member absorbs the rounding remainder.
  See `Domain/Splits/` (port of `utils/splits.ts`).
- **Payer-self-split filter everywhere** that consumes `expense_splits.settled_at`.
- **`left_at IS NULL` filter** on every active-member query.
- **Paywall triggers** — only these three, nowhere else:
  1. Adding a 3rd active member.
  2. Adding a 3rd active recurring bill.
  3. Initiating the move-out flow.
- **One view per file**, max ~200 lines. Extract subviews when it grows.
- **SwiftUI bottom sheets** use `.sheet(isPresented:)` with `.presentationDetents`.
  No custom absolute-positioning hacks.
- **Deep links** — route through `HomesplitApp.onOpenURL`; never call view-model code
  directly from `SceneDelegate`-style shims.
- **No `print` in Release** — use `Logger(subsystem:category:)` from `os`.

---

## AI Code Review Checklist (iOS)

Run through this before committing any AI-generated Swift:

1. **RLS bypass** — no code path passes the service-role key to `SupabaseClient`.
2. **Token storage** — session tokens go to Keychain via the auth storage adapter, not `UserDefaults`.
3. **Money type** — no `Double` for currency. `Decimal` only. Any `Double` in a money path
   is a bug.
4. **Split sum accuracy** — `calculateEqualSplits(amount:memberIds:)` output sums exactly
   to `amount` (first-member-absorbs-remainder).
5. **Active-member filter** — any query against `members` filters `left_at == nil`, and
   any consumer of `expense_splits` applies the payer-self-split skip.
6. **Force unwraps** — no `!` except on `IBOutlet`-style late-init or explicitly justified
   invariants. Prefer `guard let` + throw.
7. **Main-actor hygiene** — view models are `@MainActor @Observable`; long work is
   offloaded to detached tasks or repository methods and results hopped back with
   `await MainActor.run` / `@MainActor` functions.
8. **Paywall gate** — `requireProOrPresent(_:)` checked before 3rd member / 3rd bill /
   move-out start. No silent bypass.
9. **Accessibility** — every interactive view has `.accessibilityLabel` and a sensible
   trait; touch targets ≥ 44×44.
10. **No TypeScript-isms** — no `any`-equivalent `Any`, no stringly-typed routes, no
    camelCased Supabase column names that should have been `snake_case` decoded.

---

## What NOT To Build (Scope Guard)

These remain out of scope until $5K+ MRR. If an AI suggests any of them, say no:

- ❌ In-app payment processing (Apple Pay charges, Stripe, Plaid transactions) — **deeplinks only** (Venmo / Cash App).
- ❌ Bank account linking (Plaid) — V2.
- ❌ Receipt OCR / VisionKit scanning — V2.
- ❌ Multi-currency — V2.
- ❌ Chat / messaging between members — not a feature.
- ❌ Chore tracking — not Homesplit's job.
- ❌ Landlord portal / B2B — V3.
- ❌ iPad optimization — iPhone-only at launch (`supportsTablet = false`).
- ❌ Apple Watch / macOS / visionOS companion apps — post-MVP.
- ❌ Widgets / Live Activities — nice-to-have, schedule for v1.1 at earliest.

---

## Environments

Two Supabase projects, two build configurations. Never point a Release build at the
dev database.

| Env | Supabase project | Xcode config | Distribution |
|---|---|---|---|
| Development | `homesplit-dev` | `Debug-Dev` | Simulator / dev devices |
| Preview | `homesplit-dev` | `Release-Dev` | TestFlight (internal) |
| Production | `homesplit-prod` | `Release-Prod` | TestFlight external + App Store |

Secrets are read at runtime from an xcconfig-backed `Configuration.plist`:

```swift
// HomesplitIOS/App/Configuration.swift
enum Configuration {
    static let supabaseURL:    URL   = value("SUPABASE_URL")
    static let supabaseAnon:   String = value("SUPABASE_ANON_KEY")
    static let revenueCatKey:  String = value("RC_IOS_KEY")
    static let posthogKey:     String = value("POSTHOG_KEY")
    static let sentryDSN:      String = value("SENTRY_DSN")
    static let appEnv:         String = value("APP_ENV") // "development" | "production"
    static var isProd: Bool { appEnv == "production" }
    // value(_:) reads from Info.plist keys injected by Config.xcconfig
}
```

Xcconfig files under `HomesplitIOS/SupportingFiles/`:
- `Config.Debug-Dev.xcconfig`
- `Config.Release-Dev.xcconfig`
- `Config.Release-Prod.xcconfig`

**Never commit xcconfig values** — commit the template (`Config.Example.xcconfig`) with
blank values, gitignore the real ones, and store production values in a password
manager / CI secret store.

### Database migration workflow (unchanged from the RN repo)

```bash
# 1. Apply migration to dev first
supabase db push --project-ref your-dev-ref

# 2. Test: RLS tests, run the app against dev, verify in the dashboard

# 3. Only after testing passes — promote to prod
supabase db push --project-ref your-prod-ref
```

Migration files live in `supabase/migrations/` and are treated as append-only. Never
edit an applied migration — create a new one.

---

## Testing Strategy (iOS)

> **Full reference:** `.claude/docs/ios/testing.md`.

**Priority at MVP:**
- **P1 (non-negotiable):** 100% test coverage on `Domain/Splits`, `Domain/Debts`,
  `Domain/Proration`, `Domain/BillFrequency`. Money math must be correct.
- **P2 (before launch):** Integration tests against a local Supabase instance that
  exercise the key RPCs (`settle_pair`, `complete_move_out`, `create_household`,
  `join_household_by_token`) and the RLS policies.
- **P3 (only when they pay their rent):** ViewModel tests for the paywall gate,
  move-out proration view model, and add-expense validation.
- **Skip:** snapshot tests, exhaustive XCUITest flows, tests that assert "SwiftUI
  renders a Text."

```bash
# Unit tests (Swift Testing)
xcodebuild -scheme HomesplitIOS test \
  -destination 'platform=iOS Simulator,name=iPhone 16'

# A single test plan for the Domain package
xcodebuild -scheme HomesplitIOS test -only-testing:HomesplitIOSTests/DomainTests
```

---

## UI / UX Guidelines

> **Full reference:** `.claude/docs/ios/ui-ux.md`.

**Key UI rules (always apply):**
- Import colors from `DesignSystem.Colors`, spacing from `DesignSystem.Spacing`,
  typography from `DesignSystem.Typography`. No raw hex, no raw numbers in views.
- Follow **Human Interface Guidelines** — don't simulate Android. Use SF Symbols,
  system fonts, sheet detents, standard tab bar, and refresh control.
- Every interactive view: `.accessibilityLabel(_:)`, `.accessibilityAddTraits(.isButton)`
  where relevant, 44×44 minimum target.
- **Dynamic Type** support everywhere — no fixed `.font(.system(size: 17))`; use
  semantic styles (`.body`, `.title2`, …) or the `DesignSystem.Typography` scale.
- Currency formatting: `amount.formatted(.currency(code: "USD"))`, never
  `"$\(amount)"`.
- Loading & error states on every data-fetching screen — a spinner + retry button,
  not a blank view.
- **4 bottom tabs:** Home, Expenses, Bills, Household. Badges only on Home (unsettled
  count) and Bills (overdue count).
- Haptics via `UIImpactFeedbackGenerator` for destructive confirms and payment-app
  handoffs — subtle, not chatty.

---

## Migration from the React Native Codebase

The TypeScript source (`app/`, `hooks/`, `components/`, `utils/`, `stores/`, `lib/`,
`constants/`, `types/`) is the **behavioral spec** for the Swift port. When a question
comes up like "what should the dashboard show when there's no cycle?" the answer is
whatever the TS source does.

Progress is tracked in `IOS_MIGRATION.md` at the repo root — one row per feature,
status column, and owning Swift file(s). Update it whenever a feature lands.

Do not delete the RN source until `IOS_MIGRATION.md` is entirely in the "Done" column.
Even then, keep it on a frozen branch (`legacy/react-native`) before removal.

---

*Last updated: 2026-04-19 — update this file whenever the iOS stack, project structure,*
*backend schema, or scope changes.*
