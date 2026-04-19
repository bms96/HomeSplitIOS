# Homesplit — AI Development Context

> Copy this file to your project root as `CLAUDE.md` (for Claude Code) and also as `.cursorrules` (for Cursor).  
> Keep it updated as the project evolves. The AI reads this on every session.

---

## Project Overview

**Homesplit** is a household billing and expense-splitting app built exclusively for roommates. It is NOT a general-purpose expense tracker. Every feature decision should be evaluated through the lens of: "does this solve a problem specific to people who share a home?"

**The three core differentiators — never compromise these:**
1. Automated recurring bills (set once, posts every cycle automatically)
2. Move-out flow (first-class roommate departure with settlement + proration)
3. Zero transaction limits on the free tier (no daily caps, no ads, ever)

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Mobile | React Native + Expo SDK 52 | Single codebase for iOS + Android + Web |
| Navigation | Expo Router v3 (file-based) | Same mental model as Next.js |
| Backend | Supabase (PostgreSQL) | Auth + DB + Realtime + Edge Functions |
| Server state | TanStack React Query | useQuery / useMutation for all Supabase calls |
| Local state | Zustand | UI state only (modals, loading, selected items) |
| Forms | React Hook Form + Zod | All forms use Zod schemas for validation |
| Subscriptions | RevenueCat | iOS + Android billing; household-level entitlement |
| Push notifications | Expo Push Notifications | Free tier sufficient at launch scale |
| Analytics | PostHog | Event tracking + funnels + feature flags |
| Error tracking | Sentry | Crash reports in production |

---

## Project Structure

```
homesplit/
├── app/                          # Expo Router pages (file = route)
│   ├── (auth)/                   # Unauthenticated screens
│   │   ├── sign-in.tsx           # Magic link email input
│   │   └── join/[token].tsx      # Household invite deep link
│   ├── (app)/                    # Authenticated screens
│   │   ├── _layout.tsx           # Bottom tab navigator
│   │   ├── index.tsx             # Dashboard (household overview + balances)
│   │   ├── expenses/
│   │   │   ├── index.tsx         # Expense feed (all expenses this cycle)
│   │   │   └── add.tsx           # Add expense bottom sheet
│   │   ├── bills/
│   │   │   ├── index.tsx         # Recurring bills list
│   │   │   └── [id].tsx          # Add / edit recurring bill
│   │   ├── household/
│   │   │   ├── index.tsx         # Members list + household settings
│   │   │   ├── move-out.tsx      # Move-out flow (multi-step)
│   │   │   └── invite.tsx        # Share invite link screen
│   │   └── settle.tsx            # Settle up screen
├── components/
│   ├── ui/                       # Base components: Button, Input, Card, Sheet, Badge
│   ├── expenses/                 # ExpenseCard, SplitRow, CategoryIcon
│   ├── bills/                    # RecurringBillCard, BillForm, CyclePreview
│   └── household/                # MemberAvatar, BalancePill, MemberRow
├── lib/
│   ├── supabase.ts               # Supabase client (singleton)
│   ├── revenuecat.ts             # RC init + isProHousehold() helper
│   └── notifications.ts          # Push token registration + send helpers
├── hooks/
│   ├── useHousehold.ts           # Current household data + members
│   ├── useExpenses.ts            # Expense feed for current cycle
│   ├── useRecurringBills.ts      # Active recurring bill templates
│   ├── useBalances.ts            # Computed balances + debt simplification
│   └── useAuth.ts                # Supabase auth session
├── stores/
│   ├── authStore.ts              # Zustand: user session, member profile
│   └── householdStore.ts         # Zustand: selected household ID, cycle info
├── utils/
│   ├── splits.ts                 # Split calculation logic (equal, %, custom)
│   ├── debts.ts                  # Debt simplification algorithm
│   ├── proration.ts              # Mid-cycle proration math for new members
│   ├── deeplinks.ts              # Venmo + CashApp deeplink builders
│   └── currency.ts               # Format cents to dollars display
├── types/
│   └── database.ts               # Generated Supabase types (run: supabase gen types)
└── supabase/
    ├── migrations/               # SQL files — one per schema change
    └── functions/
        └── process-recurring-bills/  # Edge Function cron job
```

---

## Database Schema (Reference)

```sql
-- Core tables. Always query through RLS — never use service role key client-side.

households        (id, name, address, cycle_start_day, invite_token, created_at)
members           (id, household_id, user_id, display_name, phone, color, joined_at, left_at)
expenses          (id, household_id, paid_by_member_id, amount, description, category, date, recurring_bill_id, cycle_id)
expense_splits    (id, expense_id, member_id, amount_owed, settled_at, settlement_id)
recurring_bills   (id, household_id, name, amount, split_type, custom_splits, cycle, active, next_due_date)
billing_cycles    (id, household_id, start_date, end_date, closed_at)
settlements       (id, household_id, from_member_id, to_member_id, amount, method, settled_at, cycle_id)
move_outs         (id, household_id, departing_member_id, settlement_amount, settlement_id, pdf_url, completed_at)
subscriptions     (id, household_id, status, revenuecat_id, expires_at, updated_at)
```

**Key rules:**
- `members.user_id` is nullable — members can join without an account (via invite link)
- `members.left_at` being non-null means they've moved out — never delete member rows
- `expenses.amount` is in **dollars as a decimal** (e.g., `47.50`), not cents
- `recurring_bills.amount` is nullable — null means variable (user confirms each cycle)
- Always filter active members with `left_at IS NULL`

---

## Scoped Instructions (auto-injected by file context)

These `.instructions.md` files are automatically loaded when editing matching files:

| Instruction | Applies To | Content |
|---|---|---|
| `.github/instructions/supabase.instructions.md` | `hooks/**, lib/**, supabase/**` | Query/mutation patterns, RLS, auth, migrations |
| `.github/instructions/ui.instructions.md` | `components/**, app/**` | Colors, spacing, accessibility, component rules |
| `.github/instructions/money.instructions.md` | `utils/**` | Money math, splits, debts, proration, deeplinks |
| `.github/instructions/testing.instructions.md` | `**/*.test.ts, **/*.test.tsx` | Jest config, test priorities, what to skip |

Full reference docs live in `docs/patterns.md`, `docs/bills-vs-expenses.md`, `docs/testing.md`, `docs/e2e-scenarios.md`, and `docs/ui-ux.md`.

---

## Code Patterns & Business Logic

> **Full reference:** See `docs/patterns.md` for Supabase client setup, query/mutation patterns, Zod schemas, debt simplification algorithm, split calculation, proration math, deeplink builders, RevenueCat setup, paywall gating, and component conventions.

**Key rules (always apply):**
- Never use service role key client-side — always query through RLS
- Use SecureStore for auth session, not AsyncStorage
- Always add `enabled: !!someId` to React Query hooks when ID might be undefined
- Always invalidate related queries after mutations
- Money math: always use `toFixed(2)` and `parseFloat()` — never raw arithmetic
- Splits must always sum exactly to the expense amount (first member absorbs rounding remainder)
- Paywall triggers: 3rd member, 3rd recurring bill, or move-out flow start
- One component per file, use StyleSheet.create(), use Expo Router typed routes

---

## AI Code Review Checklist

Always review before committing AI-generated code:
1. **RLS bypass** — no query uses service role key client-side
2. **Missing `enabled` flag** — React Query hooks have `enabled: !!someId` when ID might be undefined
3. **Floating point** — money math uses `toFixed(2)` and `parseFloat()` — never raw arithmetic
4. **Split sum accuracy** — splits sum exactly to expense amount (rounding absorber pattern)
5. **`left_at IS NULL` filter** — any member query filters out departed members
6. **TypeScript `any`** — reject generated code with `any` — fix the types

---

## What NOT To Build (Scope Guard)

These are explicitly out of scope until $5K+ MRR. If an AI suggests building these, say no:

- ❌ In-app payment processing (Stripe, Plaid transactions) — use deeplinks only
- ❌ Bank account linking (Plaid) — V2 feature
- ❌ Receipt OCR scanning — V2 feature
- ❌ Multi-currency support — V2 feature
- ❌ Chat / messaging between members — not a feature
- ❌ Chore tracking — not Homesplit's job (that's Dwell's mistake)
- ❌ Landlord portal / B2B features — V3
- ❌ Web dashboard — mobile-first, web is a bonus

---

## Environment Variables

```bash
# .env.local (never commit this file)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_RC_IOS_KEY=your-revenuecat-ios-key
EXPO_PUBLIC_RC_ANDROID_KEY=your-revenuecat-android-key
EXPO_PUBLIC_POSTHOG_KEY=your-posthog-key
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn

# Server-side only (Edge Functions — never expose client-side)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```


## Useful Commands

```bash
# Start dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator  
npx expo run:android

# Generate Supabase TypeScript types (run after any schema change)
npx supabase gen types typescript --project-id your-project-id > types/database.ts

# Deploy Edge Function
npx supabase functions deploy process-recurring-bills

# EAS build (App Store submission)
npx eas build --platform all --profile production

# EAS OTA update (no App Store review needed for JS-only changes)
npx eas update --branch production --message "Fix balance calculation"
```

---

---

## Environments

Homesplit runs two Supabase projects and three EAS build profiles. Never point a production build at the dev database, and never test migrations against prod directly.

### Environment Map

| Environment | Supabase Project | EAS Profile | Who Uses It |
|---|---|---|---|
| Development | `homesplit-dev` | `development` | You, daily coding on simulator |
| Preview | `homesplit-dev` | `preview` | TestFlight / internal QA builds |
| Production | `homesplit-prod` | `production` | App Store + Google Play releases |

### Environment Files

```bash
# .env.development — loaded for development + preview builds
EXPO_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=dev-anon-key
EXPO_PUBLIC_RC_IOS_KEY=your-rc-ios-key
EXPO_PUBLIC_RC_ANDROID_KEY=your-rc-android-key
EXPO_PUBLIC_POSTHOG_KEY=your-posthog-key
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn

# .env.production — loaded for production builds only
EXPO_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key
EXPO_PUBLIC_RC_IOS_KEY=your-rc-ios-key      # RC handles sandbox/prod internally
EXPO_PUBLIC_RC_ANDROID_KEY=your-rc-android-key
EXPO_PUBLIC_POSTHOG_KEY=your-posthog-key
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

```jsonc
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "APP_ENV": "development" }
    },
    "production": {
      "env": { "APP_ENV": "production" }
    }
  }
}
```

```typescript
// lib/config.ts — single source of truth for environment
export const config = {
  supabaseUrl:     process.env.EXPO_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  isProd:          process.env.APP_ENV === 'production',
}
```

### Migration Workflow (Never Skip This Order)

```bash
# 1. Apply migration to dev first
npx supabase db push --project-ref your-dev-ref

# 2. Test: run RLS tests, verify the app works, check the dashboard

# 3. Only after testing passes — promote to prod
npx supabase db push --project-ref your-prod-ref
```

**Rules:**
- Migrations live in `supabase/migrations/` as numbered SQL files (`001_initial_schema.sql`, `002_add_move_outs.sql`)
- Never edit a migration file that has already been applied — create a new one
- Never run `supabase db reset` on prod — dev only
- RevenueCat sandbox mode is automatic in debug builds — no config needed

### .gitignore additions
```
.env.development
.env.production
.env.local
```

Never commit env files. Store prod credentials in EAS Secrets (`eas secret:create`).

---

## Testing Strategy

> **Full reference:** See `docs/testing.md` for Jest config, all example test files, RLS integration tests, and component test patterns.

**Priority at MVP:**
- **P1 (non-negotiable):** 100% unit test coverage on `utils/debts.ts`, `utils/splits.ts`, `utils/proration.ts` — money math must be correct
- **P2 (before launch):** Integration test RLS policies with local Supabase
- **P3 (only if complex):** Component tests for conditional UI logic (e.g., paywall gate)
- **Skip:** snapshot tests, E2E, navigation tests, every UI component

```bash
npx jest                          # Run all tests
npx jest utils/debts.test.ts      # Run specific file
npx jest --watch                  # Watch mode
npx jest --coverage               # Coverage report
```

---

---

## UI/UX Guidelines

> **Full reference:** See `docs/ui-ux.md` for color tokens, typography scale, spacing system, component size standards, platform rules, navigation architecture, screen specs, accessibility requirements, empty states, error messages, and AI code generation rules.

**Key UI rules (always apply):**
- Import colors from `@/constants/colors`, spacing from `@/constants/spacing` — never raw hex or numbers
- Use `Platform.select` or `Platform.OS` for any value that differs between iOS/Android
- Add `accessibilityLabel` and `accessibilityRole` to all interactive elements
- Handle loading and error states on every data-fetching screen
- Use `@gorhom/bottom-sheet` for bottom sheets — not Modal or absolute-positioned Views
- Currency: always format with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
- Keep components under 150 lines — extract sub-components beyond that
- 4 bottom tabs: Home, Expenses, Bills, Household

---

*Last updated: April 2026 — update this file whenever the schema, stack, scope, or design system changes.*
