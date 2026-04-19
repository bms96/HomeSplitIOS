# Bills vs. Expenses

Homesplit tracks two very different kinds of household costs. They look similar at a glance but live in separate tables, flow through different screens, and settle through different mechanisms. Getting the distinction right is critical — mixing them is the root cause of most "why does X appear twice?" / "why doesn't this show up in balances?" bugs.

> **TL;DR:** Expenses are one-time, debt-creating line items that flow into the balance graph. Bills are recurring templates that track per-member payment status on their own table and never create debts. A bill is *not* an expense.

---

## At a glance

| | Expense | Recurring Bill |
|---|---|---|
| Purpose | One-time spend by one member on behalf of the household | Shared recurring obligation everyone pays separately (rent, utilities) |
| Primary table | `expenses` + `expense_splits` | `recurring_bills` + `bill_cycle_payments` |
| Who enters it | A member, manually, after the fact | Any member, once, as a template |
| Who pays the vendor | One member (the payer) fronts the cost | Each member pays the vendor directly (e.g., portal, autopay) |
| Creates roommate-to-roommate debt? | **Yes** — payer is owed by each split member | **No** — each member owes the vendor, not each other |
| Shows up in `useBalances` | Yes | No |
| Shows up in Expenses tab | Yes | No (lives in Bills tab only) |
| Settlement unit | `expense_splits.settled_at` (per split) or a `settlements` row | `bill_cycle_payments` row (one per member per cycle) |
| Cron involvement | None | `process-recurring-bills` advances `next_due_date` daily |
| Rolls over each cycle? | No — tied to one `cycle_id` | Yes — one payment-tracking window per `(bill, cycle)` |

---

## Expenses (one-time)

An **expense** is a real transaction that already happened: someone paid for groceries, someone covered a dinner, someone bought a shared lamp. One member fronts the money and the others owe them back.

### Data model

```
expenses
  (id, household_id, cycle_id, paid_by_member_id,
   amount, description, category, date, due_date,
   recurring_bill_id  -- always NULL post-migration 012; legacy only
  )

expense_splits
  (id, expense_id, member_id, amount_owed,
   settled_at, settlement_id)
```

- `paid_by_member_id` — the member who fronted the cash.
- One `expense_splits` row per member included in the split (including the payer; see "Payer's self-split" below).
- `amount_owed` across splits must sum to `expenses.amount` exactly — first member absorbs the rounding remainder (`utils/splits.ts::calculateEqualSplits`).
- `settled_at` flips when the split gets paid back, either:
  - individually (mark-paid button → direct update), or
  - via `settle_pair` RPC (creates a `settlements` row and links `settlement_id`).

### Flow

1. Member opens the **Add expense** bottom sheet and enters amount + who paid + who's included.
2. `useAddExpense` inserts one `expenses` row and N `expense_splits` rows in a single mutation.
3. `useBalances` reads unsettled splits for the current cycle and feeds them to `utils/debts.ts` for simplification.
4. Settle-up screen surfaces the net pairwise debts; tapping settle either deeplinks to Venmo/Cash App and/or flips the splits to `settled_at != null` via `settle_pair`.

### Payer's self-split (important gotcha)

The add-expense flow creates a split row for **every** included member — including the payer. The payer's row has `amount_owed > 0` but is a no-op for debt purposes: they don't owe themselves.

Every consumer of `expense_splits` must ignore splits where `member_id === expenses.paid_by_member_id`:

- `useBalances` — filtered in the `rawDebts` map (see `r.member_id !== r.paid_by_member_id`).
- Dashboard counts (`app/(app)/index.tsx`) — `iOwe` skips self-pay expenses.
- Expenses "Unpaid" filter (`isExpensePaid` in `app/(app)/expenses/index.tsx`) — excludes the payer's split before deciding "paid."
- `ExpenseCard`, expense detail screen — treat the payer's split as already covered.

Any new surface that reads `settled_at` on splits must apply the same rule or the payer will look like they haven't paid themselves back.

---

## Recurring Bills

A **recurring bill** is a template for a shared ongoing obligation: rent, electricity, internet, Netflix. The household agrees to split it and each member pays the vendor their share on their own (via autopay, the landlord's portal, Venmo to the bill-payer, etc.). Homesplit tracks **who has paid this cycle** — not who owes whom.

### Data model

```
recurring_bills
  (id, household_id, name, amount, frequency,
   next_due_date, active, custom_splits)

bill_cycle_amounts
  (id, bill_id, cycle_id, amount,
   UNIQUE (bill_id, cycle_id))

bill_cycle_payments
  (id, bill_id, cycle_id, member_id, settled_at, created_at,
   UNIQUE (bill_id, cycle_id, member_id))
```

- `amount` on `recurring_bills` is the **template** amount. Nullable — `NULL` means **variable** (e.g., electricity: the number changes every cycle, so there is no template).
- `bill_cycle_amounts` stores a per-`(bill, cycle)` **override**. For variable bills this row is required before anyone can mark paid for that cycle; a BEFORE INSERT trigger on `bill_cycle_payments` enforces it server-side (migration 013). For fixed bills it is optional (lets the household record a one-off deviation for a single cycle without editing the template).
- **Effective amount** for any cycle = `bill_cycle_amounts.amount` if present, otherwise `recurring_bills.amount`. Every consumer that shows an amount or splits a share for a cycle must resolve through this rule, not read `recurring_bills.amount` directly.
- `frequency` is `'weekly' | 'biweekly' | 'monthly'`.
- `next_due_date` is the date the cron uses to decide when the bill rolls to the next cycle window.
- `custom_splits.excluded_member_ids: string[]` — members opted out of this bill (e.g., one roommate doesn't use the gym membership).
- `bill_cycle_payments` has at most one row per `(bill, cycle, member)`. Absence of a row = unpaid. Presence of a row = paid.

### Flow

1. Member creates a bill once in the Bills tab: name, amount (or variable), frequency, optional exclusions.
2. `process-recurring-bills` Edge Function runs daily (pg_cron → http_post). For each bill whose `next_due_date <= today`:
   - Advances `next_due_date` by the frequency.
   - Sends a push notification to the household.
   - **Does not create any expense or split rows.**
3. Each member sees the bill on the Bills list with a "paid / unpaid this cycle" indicator (`useBillCyclePayments`).
4. For **variable** bills, someone opens the bill detail screen and enters this cycle's amount (upserts a `bill_cycle_amounts` row via `useSetBillCycleAmount`). Until that row exists, the mark-paid action is blocked both client-side (button disabled, alert) and server-side (the `bcp_enforce_amount` trigger raises).
5. When a member pays the vendor, they tap **Mark paid** → inserts a `bill_cycle_payments` row. Tapping again removes the row.

### What bills do *not* do

- They do not post `expenses` rows. (They used to, pre-migration 012. If you find `expenses.recurring_bill_id IS NOT NULL`, that's legacy data.)
- They do not create debts, balances, or `expense_splits`. A bill can never make one roommate owe another.
- They do not affect `useBalances`, the settle-up screen, or the dashboard "You owe / Owed to you" counts.
- Unpaid bills do **not** roll forward as debt into the next cycle. If Alice skipped the water bill in April, that's a landlord-vs-Alice problem, not a household debt. (This is deliberate — see the "Split obligation, separate rails" note below.)

---

## When to use which

**Use an expense when:**
- One member paid the full amount upfront and needs to be reimbursed.
- The cost is one-off (groceries, an Uber, a shared Amazon order).
- You want it to show up on the balance graph.

**Use a recurring bill when:**
- The cost repeats on a schedule (monthly rent, weekly housekeeping, etc.).
- Every member pays the vendor directly (or pays one designated member outside the app).
- You only need a checklist of who has paid this cycle, not a debt graph.

**Edge case — one person fronts a recurring bill:** If your household has one member who always pays the full rent and collects from the others, that's functionally an expense, not a bill. Either (a) add it as a manual expense each month, or (b) keep the recurring bill for the reminder value and separately add an expense for the portion the payer fronted. Don't try to bend the bill system into a debt tracker.

---

## Split obligation, separate rails

The two systems intentionally don't share settlement state, even though both use the word "paid." The mental model:

- **Expenses** = internal roommate debt. Settled pairwise between members.
- **Bills** = external vendor obligation. Settled independently by each member with the vendor.

This is why balances can say "everyone is settled" even when nobody has paid the landlord yet: Homesplit isn't tracking the landlord relationship. If you want that, record it as a monthly expense instead.

---

## Related files

- `hooks/useExpenses.ts`, `hooks/useBalances.ts` — expense & balance data
- `hooks/useRecurringBills.ts` — bills + `useBillCyclePayments` + `useMarkBillPaid`
- `components/expenses/ExpenseCard.tsx`, `components/bills/RecurringBillCard.tsx`
- `app/(app)/expenses/*`, `app/(app)/bills/*`
- `utils/splits.ts`, `utils/debts.ts`
- `supabase/functions/process-recurring-bills/index.ts`
- `supabase/migrations/012_bill_cycle_payments.sql` — the migration that separated the two systems
- `supabase/migrations/013_bill_cycle_amounts.sql` — per-cycle amount overrides + `bcp_enforce_amount` trigger
