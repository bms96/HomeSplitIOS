# End-to-End Scenario Tests

> Complement to `docs/testing.md`. Read that first for the overall priority pyramid. This file is scoped to scenario-level coverage: full user flows exercised end-to-end.

## Scope note — what "end-to-end" means here

Homesplit deliberately does **not** run device-level E2E (Detox / Maestro / XCUITest). That rule from `docs/testing.md` stands. "End-to-end" in this file means **scenario-based integration tests that exercise a full user flow through the real data layer**:

- Run against local Supabase (`npx supabase start`) using the anon key and a seeded auth user, the same way the P2 RLS tests do.
- Call hooks / util functions / RPCs in sequence, asserting on observable state (rows in `expense_splits`, output of `useBalances`, etc.).
- No simulator, no React Native rendering, no navigation.

If a scenario is too expensive to automate this way, **document it as a manual pre-release checklist item** in the "Manual-only scenarios" section at the bottom. Don't reach for Detox.

---

## When to write a scenario test

A scenario test earns its keep when it guards an invariant that crosses layers — for example, the payer-self-split rule that caused the "balances say settled but UI says unpaid" bug. Symptoms that argue for a scenario test over a pure unit test:

- The bug was only visible once two pieces of logic composed (hook + UI, RPC + filter, cron + downstream query).
- The fix touched 3+ files and relied on them staying in sync.
- Correctness depends on database state, not just pure-function output.

If the scenario reduces to pure math on in-memory inputs, write a unit test instead — cheaper, faster, no Supabase required.

---

## Test harness

```bash
# One-time per machine
npx supabase start          # spins local Postgres + Auth on :54321
npx supabase db push        # applies migrations

# Per run
npm run test:e2e            # add to package.json: "jest --testPathPattern=tests/e2e"
```

```typescript
// tests/e2e/harness.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const LOCAL_URL = 'http://localhost:54321'
const ANON_KEY  = process.env.SUPABASE_LOCAL_ANON_KEY!

export async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(LOCAL_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password: 'test-password' })
  if (error) throw error
  return client
}

/** Seed a household with N members all signed in. Returns client per member + ids. */
export async function seedHousehold(memberCount: number): Promise<{
  household_id: string
  cycle_id: string
  members: Array<{ id: string; email: string; client: SupabaseClient }>
}> {
  // … creates auth users, inserts household + members + opens an initial cycle
}

/** Wipe rows created by the test, leaving schema intact. */
export async function cleanup(household_id: string): Promise<void> { /* … */ }
```

Every scenario uses this harness, runs in its own `beforeAll` / `afterAll`, and isolates by `household_id` so parallel tests don't collide.

---

## Scenario catalogue

Each scenario lists (1) the flow, (2) the invariants to assert, and (3) the files it guards.

### 1. Expense → balance → settle-up

**Flow**
1. Alice adds a $60 groceries expense, split equally between Alice + Bob + Carol.
2. Read `useBalances` for Alice's view of the current cycle.
3. Bob triggers `settle_pair` for his $20 share.
4. Re-read balances.

**Assertions**
- After step 1: `expense_splits` has 3 rows summing to $60. Alice's row has `amount_owed = 20`, `settled_at IS NULL`.
- After step 2: `useBalances` returns 2 pairwise debts (Bob→Alice $20, Carol→Alice $20). Alice's self-split is filtered out.
- After step 3: Bob's split has `settled_at != null` + `settlement_id != null`. A `settlements` row exists.
- After step 4: `useBalances` returns 1 pairwise debt (Carol→Alice $20).

**Guards:** `useBalances.ts`, `settle_pair` RPC, `utils/splits.ts`, `utils/debts.ts`, payer-self-split rule.

---

### 2. Payer's self-split never surfaces as "unpaid"

**Flow**
1. Alice adds a $30 expense, paid by Alice, split between Alice + Bob.
2. Bob marks his $15 split paid.
3. Evaluate every surface that reads `settled_at`.

**Assertions**
- `isExpensePaid(expense)` returns `true` after step 2, even though Alice's self-split row still has `settled_at IS NULL`.
- Dashboard `iOweCount` for Alice is 0 for this expense (she paid it).
- `useBalances` returns an empty debt graph.
- `ExpenseCard` status label for Alice is "You paid · settled", not "Your share unpaid".

**Guards:** the payer-self-split rule in `app/(app)/expenses/index.tsx`, `app/(app)/index.tsx`, `components/expenses/ExpenseCard.tsx`, `app/(app)/expenses/[id].tsx`. This is the bug fixed in the balances-screen regression; keep the test to prevent reintroduction.

---

### 3. Recurring bill lifecycle (cron + mark-paid)

**Flow**
1. Alice creates a $1,500 rent bill, frequency `monthly`, `next_due_date` = today.
2. Invoke the cron handler directly (`process-recurring-bills`).
3. Bob taps "Mark paid" for the current cycle.
4. Bob taps again (toggle off).
5. Advance time one month; invoke the cron again.

**Assertions**
- After step 2: no rows inserted into `expenses` or `expense_splits`. `recurring_bills.next_due_date` advances by one month.
- After step 3: one `bill_cycle_payments` row with `(bill_id, cycle_id, member_id = Bob)`.
- After step 4: zero `bill_cycle_payments` rows for Bob this cycle.
- After step 5: `next_due_date` advanced again. Old cycle's payment rows untouched (history preserved).

**Guards:** migration 012 separation, cron semantics described in `docs/bills-vs-expenses.md`. A regression where the cron starts posting expenses again would be caught here.

---

### 4. Bill payments never leak into balances

**Flow**
1. Alice creates a $1,500 rent bill.
2. Bob marks himself paid. Carol does not.
3. Read `useBalances` for the current cycle.

**Assertions**
- `useBalances` returns an empty debt graph — the bill does not create roommate debt.
- Dashboard "You owe" / "Owed to you" counts are 0.
- The Bills tab shows "1 of 3 paid" for the bill.

**Guards:** the split-rails rule in `docs/bills-vs-expenses.md`. Any query that accidentally joins `bill_cycle_payments` into the balance graph would fail this.

---

### 5. Invite → join → expense inclusion

**Flow**
1. Alice creates a household (she's the only member).
2. Alice adds a $20 expense.
3. Bob joins via invite token.
4. Alice adds a $30 expense.

**Assertions**
- The $20 expense has exactly 1 split (Alice).
- The $30 expense has 2 splits (Alice + Bob), summing to $30.
- `useBalances` shows Bob owes Alice $15.
- Member query filter `left_at IS NULL` returns both members.

**Guards:** join flow, default "include everyone" logic in `app/(app)/expenses/add.tsx:85`, split math.

---

### 6. Move-out proration + settlement

**Flow**
1. 3-member household, cycle May 1–May 31.
2. Post recurring rent ($1,500) as a manual expense on May 1 (since bills no longer post expenses).
3. Add one-time expense May 10 ($30 groceries, split 3 ways).
4. Add one-time expense May 20 ($25 takeout, split 3 ways).
5. Sam starts move-out on May 15 → run through `move_out` RPC.

**Assertions**
- Sam's prorated rent share ≈ $241.94 (15 / 31 days).
- May 10 groceries: Sam's $10 split stands.
- May 20 takeout: Sam's split removed, redistributed to the 2 stayers.
- `move_outs.settlement_amount` matches the computed net (see `docs/patterns.md` worked example: $143.71).
- `members.left_at` is set for Sam after the final confirm step.

**Guards:** `utils/proration.ts`, move-out RPC, cycle-scoped filtering in balance queries.

---

### 7. Paywall gate triggers at thresholds

**Flow**
1. Free household with 2 members tries to add a 3rd.
2. Free household with 2 recurring bills tries to add a 3rd.
3. Free household starts the move-out flow.

**Assertions**
- Each trigger returns the "requires pro" gate result from `usePaywallGate` — the mutation is not allowed to complete.
- Setting the household's `subscriptions.status = 'active'` unblocks all three.

**Guards:** `usePaywallGate`, `FREE_BILL_LIMIT`, RevenueCat entitlement check. The free-tier promise ("zero transaction limits") is a project differentiator — the gate must only trigger on the advertised thresholds, not on expense count.

---

### 8. RLS cross-household isolation under real flows

This is the P2 RLS test extended: instead of just asserting "empty read," exercise an actual write flow from a wrong-household client.

**Flow**
1. Seed two households, A and B. Alice in A, Eve in B.
2. As Eve, attempt to:
   - read A's expenses
   - insert an expense into A
   - call `settle_pair` against A's members
   - insert a `bill_cycle_payments` row referencing A's bill

**Assertions**
- Every attempt returns 0 rows or an RLS error — none leaks or mutates A's data.

**Guards:** RLS policies on `expenses`, `expense_splits`, `settlements`, `bill_cycle_payments`, `recurring_bills`. The policies are the last line of defense if a client-side filter is ever missed.

---

## Manual-only scenarios (pre-release checklist)

These are too environment-specific or too visual to justify automating. Walk through them on a real device before an App Store submission.

- **Magic-link sign-in** — tap link from iOS Mail; verify it returns to the app and the session persists across a cold start.
- **Push notifications** — receive the daily bill reminder on a physical device (iOS and Android); tap the push and confirm it deep-links to the Bills tab.
- **Venmo / Cash App deeplinks** — tap settle on a non-empty debt; confirm the external app opens pre-filled (iOS 17 + Android 14).
- **RevenueCat paywall** — run a sandbox purchase; confirm the entitlement flips and the household unblocks all three paywalled flows in one session.
- **Onboarding empty states** — brand-new household with no expenses, no bills, no members: every tab should render a helpful empty state, never a white screen.
- **Move-out PDF** — generate a PDF, open it in a share sheet, and verify the layout matches `docs/patterns.md`.

---

## Adding a new scenario

1. Start with the bug that motivated it. If there's no recent bug, you probably don't need a new scenario — prefer extending an existing one.
2. Pick the harness helpers you need; avoid adding new seed variants unless a genuinely new shape is required.
3. Assert on observable state (rows, hook outputs), not implementation details (internal query keys, cache shape).
4. If the scenario needs more than 60s to run locally, split it — slow tests get skipped.
5. Update this catalogue with the flow, assertions, and which files it guards.
