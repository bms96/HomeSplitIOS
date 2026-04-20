# Bills vs. Expenses (iOS)

> Direct port of the backend rules. The SQL schema is identical across platforms —
> only the client code changes. This doc exists so a new contributor reading only
> the Swift codebase gets the full mental model.

Homesplit tracks two very different kinds of household costs. They look similar
at a glance but live in separate tables, flow through different screens, and
settle through different mechanisms. Getting the distinction wrong is the root
cause of most "why does X appear twice?" / "why doesn't this show up in
balances?" bugs.

> **TL;DR:** Expenses are one-time, debt-creating line items that flow into the
> balance graph. Bills are recurring templates that track per-member payment
> status on their own table and never create debts. A bill is **not** an expense.

---

## At a glance

| | Expense | Recurring Bill |
|---|---|---|
| Purpose | One-time spend by one member on behalf of the household | Shared recurring obligation everyone pays separately (rent, utilities) |
| Primary tables | `expenses` + `expense_splits` | `recurring_bills` + `bill_cycle_payments` |
| Who enters it | A member, manually, after the fact | Any member, once, as a template |
| Who pays the vendor | One member (the payer) fronts the cost | Each member pays the vendor directly (autopay, portal, Venmo to bill-payer) |
| Creates roommate-to-roommate debt? | **Yes** — payer is owed by each split member | **No** — each member owes the vendor, not each other |
| Shows up in balances? | Yes | No |
| Shows up in Expenses tab | Yes | No (lives in Bills tab only) |
| Settlement unit | `expense_splits.settled_at` (per split) or a `settlements` row | `bill_cycle_payments` row (one per member per cycle) |
| Cron involvement | None | `process-recurring-bills` advances `next_due_date` daily |
| Rolls over each cycle? | No — tied to one `cycle_id` | Yes — one payment-tracking window per `(bill, cycle)` |

---

## Expenses (one-time)

A **real transaction that already happened**: someone paid for groceries, dinner,
a shared lamp. One member fronts the money and the others owe them back.

### Data model

```
expenses
  (id, household_id, cycle_id, paid_by_member_id,
   amount, description, category, date, due_date,
   recurring_bill_id  -- always NULL post-migration 012; legacy only)

expense_splits
  (id, expense_id, member_id, amount_owed,
   settled_at, settlement_id)
```

- `paid_by_member_id` — the member who fronted the cash.
- One `expense_splits` row per included member, **including the payer**.
- `amount_owed` across splits must sum to `expenses.amount` exactly — first member
  absorbs the rounding remainder (`Domain/Splits/Splits.swift`).
- `settled_at` flips when the split gets paid back, either individually (mark-paid
  button → direct update) or via `settle_pair` RPC (creates a `settlements` row
  and links `settlement_id`).

### Flow (iOS)

1. User opens `AddExpenseView` and enters amount + who paid + who's included.
2. `AddExpenseViewModel.save()` calls `ExpensesRepository.add(_:)` which inserts
   one `expenses` row and N `expense_splits` rows in sequence (ideally wrap in a
   SQL transaction via RPC; single-statement insert-with-returning-plus-batch is
   acceptable at MVP).
3. `BalancesRepository` reads unsettled splits for the current cycle and feeds
   them to `Domain/Debts/` for simplification.
4. Settle-up surface calls `settle_pair` RPC which flips affected splits to
   `settled_at != nil` and creates a `settlements` row.

### Payer's self-split (important gotcha)

The add-expense flow creates a split row for **every** included member —
including the payer. The payer's row has `amount_owed > 0` but is a no-op for
debt purposes: they don't owe themselves.

**Every consumer of `expense_splits` must ignore splits where
`member_id == expenses.paid_by_member_id`**:

- `BalancesRepository` — filter in the raw-debt reduction.
- Dashboard "You owe" count — skip self-pay expenses.
- Expenses "Unpaid" filter — `isExpensePaid(expense)` must exclude the payer's
  split before deciding "paid."
- `ExpenseCard` and expense detail view — treat the payer's split as already
  covered.

Any new surface that reads `settled_at` must apply the same rule or the payer
will look like they haven't paid themselves back. Put this filter in a single
helper (`ExpenseSplit+PayerSelf.swift`) and reuse it.

---

## Recurring Bills

A **template** for a shared ongoing obligation (rent, electricity, internet,
Netflix). Each member pays the vendor on their own; Homesplit tracks **who has
paid this cycle**, not who owes whom.

### Data model

```
recurring_bills
  (id, household_id, name, amount, frequency,
   next_due_date, active, split_type, custom_splits)

bill_cycle_amounts
  (id, bill_id, cycle_id, amount, UNIQUE (bill_id, cycle_id))

bill_cycle_payments
  (id, bill_id, cycle_id, member_id,
   settled_at, created_at,
   UNIQUE (bill_id, cycle_id, member_id))
```

- `recurring_bills.amount` — the **template** amount. `nil` means **variable**
  (e.g., electricity).
- `bill_cycle_amounts` stores a per-`(bill, cycle)` override. For variable bills
  it is **required** before anyone can mark paid (enforced server-side by the
  `bcp_enforce_amount` trigger, migration 013). For fixed bills it is optional
  (a one-off deviation for a single cycle).
- **Effective amount for a cycle** = `bill_cycle_amounts.amount` if present,
  otherwise `recurring_bills.amount`. Every consumer that displays an amount or
  splits a share must resolve through this rule — never read
  `recurring_bills.amount` directly.
- `frequency`: `weekly | biweekly | monthly | monthly_first | monthly_last`.
- `custom_splits.excluded_member_ids: [UUID]` — members opted out of this bill.
- `bill_cycle_payments` has **at most one row per `(bill, cycle, member)`**.
  Absence of a row = unpaid. Presence = paid.

### Flow (iOS)

1. A member creates a bill: name, amount (or variable), frequency, optional
   exclusions, split type.
2. The `process-recurring-bills` Edge Function runs daily (pg_cron → http_post).
   For each bill whose `next_due_date <= today`:
   - Advances `next_due_date` by the frequency.
   - Sends a push notification to household members.
   - **Does not create any expense or split rows.**
3. Each member sees the bill on the Bills list with a "paid / unpaid this cycle"
   indicator.
4. For **variable** bills, someone opens the bill detail view and enters this
   cycle's amount (upserts a `bill_cycle_amounts` row). Until that row exists,
   the mark-paid action is blocked both client-side (button disabled, alert) and
   server-side (the trigger raises).
5. When a member pays the vendor, they tap **Mark paid** → inserts a
   `bill_cycle_payments` row. Tapping again removes the row.

### What bills do **not** do

- They do not post `expenses` rows (changed in migration 012).
- They do not create debts, balances, or `expense_splits`. A bill can never make
  one roommate owe another.
- They do not affect the balances screen, dashboard "You owe / Owed to you"
  counts, or the Expenses tab.
- Unpaid bills do **not** roll forward as debt into the next cycle.

---

## When to use which

**Use an expense when:**
- One member paid the full amount upfront and needs to be reimbursed.
- The cost is one-off (groceries, an Uber, a shared Amazon order).
- You want it on the balance graph.

**Use a recurring bill when:**
- The cost repeats on a schedule (monthly rent, weekly cleaning, Netflix).
- Every member pays the vendor directly (or pays one designated member outside
  the app).
- You only need a checklist of "who has paid this cycle," not a debt graph.

**Edge case — one person fronts a recurring bill.** If one roommate always pays
rent and collects from the others, that's functionally an expense. Either add it
as a manual expense each month, or keep the bill for the reminder value and
separately add an expense for the fronted portion. Don't try to bend the bill
system into a debt tracker.

---

## Split obligation, separate rails

The two systems intentionally **don't share settlement state**, even though both
use the word "paid."

- **Expenses** = internal roommate debt. Settled pairwise between members.
- **Bills** = external vendor obligation. Settled independently by each member
  with the vendor.

This is why balances can say "everyone is settled" even when nobody has paid the
landlord yet. Homesplit isn't tracking the landlord relationship. If you want
that, record it as a monthly expense instead.

---

## Related iOS files (target layout)

- `Core/Supabase/Repositories/ExpensesRepository.swift`,
  `BalancesRepository.swift`, `SettlementsRepository.swift`
- `Core/Supabase/Repositories/RecurringBillsRepository.swift`,
  `BillCyclePaymentsRepository.swift`, `BillCycleAmountsRepository.swift`
- `Features/Expenses/*`, `Features/Bills/*`
- `Domain/Splits/Splits.swift`, `Domain/Debts/Debts.swift`
- `Domain/BillFrequency/BillFrequency.swift`,
  `Domain/BillStatus/BillStatus.swift`

---

## Related backend files (shared with RN)

- `supabase/functions/process-recurring-bills/index.ts`
- `supabase/migrations/012_bill_cycle_payments.sql` — the migration that
  separated the two systems.
- `supabase/migrations/013_bill_cycle_amounts.sql` — per-cycle amount overrides
  + `bcp_enforce_amount` trigger.
- `supabase/migrations/014_advance_bill_on_full_payment.sql` — trigger that
  advances `next_due_date` when every included member has marked paid.
