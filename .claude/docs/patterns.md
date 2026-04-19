# Homesplit — Code Patterns Reference

> Referenced from `CLAUDE.md`. Read this file when working on Supabase queries, mutations, RevenueCat, forms, business logic implementations, or component conventions.

---

## Supabase Patterns

### Client initialization
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Database } from '@/types/database'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

### Standard query hook pattern
```typescript
// hooks/useExpenses.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useExpenses(householdId: string, cycleId: string) {
  return useQuery({
    queryKey: ['expenses', householdId, cycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, paid_by_member:members(*), expense_splits(*)')
        .eq('household_id', householdId)
        .eq('cycle_id', cycleId)
        .order('date', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!householdId && !!cycleId,
  })
}
```

### Standard mutation pattern
```typescript
// Always invalidate related queries after a mutation
const addExpense = useMutation({
  mutationFn: async (input: AddExpenseInput) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...input })
      .select()
      .single()
    if (error) throw error
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expenses', householdId] })
    queryClient.invalidateQueries({ queryKey: ['balances', householdId] })
  },
})
```

### Never do this
```typescript
// ❌ WRONG — bypasses RLS, exposes service role key
const supabase = createClient(url, SERVICE_ROLE_KEY)

// ❌ WRONG — raw SQL in components
const { data } = await supabase.rpc('my_function')  // fine for RPC, not for direct SQL

// ❌ WRONG — storing session in AsyncStorage
auth: { storage: AsyncStorage }  // use SecureStore instead
```

---

## Zod Schemas (Forms)

Define schemas in the same file as the form component, or in `utils/schemas.ts` if shared.

```typescript
// Example: Add Expense schema
const addExpenseSchema = z.object({
  amount: z.string()
    .min(1, 'Amount is required')
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Must be a positive number'),
  description: z.string().min(1, 'Description is required').max(100),
  category: z.enum(['rent', 'utilities', 'groceries', 'household', 'food', 'transport', 'other']),
  paid_by_member_id: z.string().uuid(),
  split_type: z.enum(['equal', 'custom_pct', 'custom_amt']),
  custom_splits: z.array(z.object({
    member_id: z.string().uuid(),
    value: z.number().positive(),
  })).optional(),
})

type AddExpenseInput = z.infer<typeof addExpenseSchema>
```

---

## Key Business Logic

### Debt Simplification Algorithm
```typescript
// utils/debts.ts
// Reduces N debts to minimum transactions. Run client-side.
export type Debt = { from: string; to: string; amount: number }

export function simplifyDebts(debts: Debt[]): Debt[] {
  const balance: Record<string, number> = {}
  for (const d of debts) {
    balance[d.from] = (balance[d.from] ?? 0) - d.amount
    balance[d.to]   = (balance[d.to]   ?? 0) + d.amount
  }
  const creditors = Object.entries(balance)
    .filter(([, v]) => v > 0.01)
    .sort((a, b) => b[1] - a[1])
  const debtors = Object.entries(balance)
    .filter(([, v]) => v < -0.01)
    .sort((a, b) => a[1] - b[1])

  const result: Debt[] = []
  let ci = 0, di = 0
  while (ci < creditors.length && di < debtors.length) {
    const settled = Math.min(creditors[ci][1], -debtors[di][1])
    result.push({ from: debtors[di][0], to: creditors[ci][0], amount: settled })
    creditors[ci][1] -= settled
    debtors[di][1]   += settled
    if (creditors[ci][1] < 0.01) ci++
    if (debtors[di][1]  > -0.01) di++
  }
  return result
}
```

### Split Calculation
```typescript
// utils/splits.ts
export function calculateEqualSplits(amount: number, memberIds: string[]) {
  const base = Math.floor((amount / memberIds.length) * 100) / 100
  const remainder = parseFloat((amount - base * memberIds.length).toFixed(2))
  return memberIds.map((id, i) => ({
    member_id: id,
    amount_owed: i === 0 ? parseFloat((base + remainder).toFixed(2)) : base,
  }))
  // First member absorbs rounding remainder — always makes splits sum to total
}
```

### Mid-Cycle Proration
```typescript
// utils/proration.ts
// When a new member joins mid-cycle, calculate their prorated share
export function prorateAmount(
  fullAmount: number,
  cycleStartDate: Date,
  cycleEndDate: Date,
  joinDate: Date
): number {
  const totalDays = differenceInDays(cycleEndDate, cycleStartDate)
  const remainingDays = differenceInDays(cycleEndDate, joinDate)
  return parseFloat(((fullAmount * remainingDays) / totalDays).toFixed(2))
}
```

### Venmo / CashApp Deeplinks
```typescript
// utils/deeplinks.ts
export function venmoDeeplink(amount: number, note: string, username?: string) {
  const base = username
    ? `venmo://paycharge?txn=pay&recipients=${username}`
    : 'venmo://paycharge?txn=pay'
  return `${base}&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`
}

export function cashappDeeplink(amount: number, cashtag?: string) {
  return cashtag
    ? `https://cash.app/$${cashtag}/${amount.toFixed(2)}`
    : `https://cash.app`
}
```

---

## RevenueCat Patterns

```typescript
// lib/revenuecat.ts
import Purchases from 'react-native-purchases'
import { Platform } from 'react-native'

export async function initRevenueCat(userId: string) {
  Purchases.configure({
    apiKey: Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!,
  })
  await Purchases.logIn(userId)
}

export async function isProHousehold(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo()
  return !!info.entitlements.active['pro_household']
}
```

**Paywall trigger points** (the only places in the app where paywall appears):
1. Adding a 3rd household member → check before saving
2. Adding a 3rd recurring bill → check before saving
3. Initiating move-out flow → check at flow start

```typescript
// Pattern for gating a Pro feature
const handleAddMember = async () => {
  const isPro = await isProHousehold()
  const memberCount = household.members.filter(m => !m.left_at).length
  if (!isPro && memberCount >= 2) {
    router.push('/paywall')  // or show bottom sheet
    return
  }
  // proceed with adding member
}
```

---

## Component Conventions

### File structure (one component per file)
```typescript
// components/expenses/ExpenseCard.tsx
import { ... } from 'react-native'

type Props = {
  expense: Database['public']['Tables']['expenses']['Row'] & {
    paid_by_member: Database['public']['Tables']['members']['Row']
    expense_splits: Database['public']['Tables']['expense_splits']['Row'][]
  }
  currentMemberId: string
}

export function ExpenseCard({ expense, currentMemberId }: Props) {
  // ...
}
```

### Styling
- Use **StyleSheet.create()** for all styles — no inline style objects
- No CSS-in-JS libraries (too heavy for mobile)
- Define a `theme.ts` with colors, spacing, typography constants early — reference it everywhere
- Use `Platform.select()` for iOS/Android differences

### Navigation
```typescript
// Always use typed routes from Expo Router
import { router } from 'expo-router'
router.push('/expenses/add')         // navigate
router.back()                         // go back
router.replace('/(app)')              // replace (no back stack)

// Deep link to invite
const inviteUrl = `https://homesplit.app/join/${household.invite_token}`
// Falls back to web if app not installed
```

---

## Recurring Bill Cron Semantics

> **Architecture note:** Bills and expenses are fully separate systems — see `docs/bills-vs-expenses.md` for the why, the data model, and the usage rules. The cron no longer posts expense rows (changed in migration 012); it only advances due dates and sends reminders.

### How the daily cron works

The Edge Function `process-recurring-bills` runs once a day (pg_cron → http_post, see migration 003). For every active recurring bill whose `next_due_date` is today or in the past:

1. Advance `next_due_date` to the next occurrence (by `frequency`).
2. Send a push notification to the household ("Rent is due — $1,500").
3. **Do not insert any `expenses` or `expense_splits` rows.**

Per-member payment tracking lives on `bill_cycle_payments` (one row per `(bill, cycle, member)`, inserted when a member taps "Mark paid"). Balances, debts, and the Expenses tab are untouched by bills.

```typescript
// supabase/functions/process-recurring-bills/index.ts (simplified)
function advanceDueDate(iso: string, frequency: Frequency): string {
  const d = new Date(iso)
  if (frequency === 'weekly')   d.setUTCDate(d.getUTCDate() + 7)
  if (frequency === 'biweekly') d.setUTCDate(d.getUTCDate() + 14)
  if (frequency === 'monthly')  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().split('T')[0]
}

// For each due bill:
//   1. update recurring_bills set next_due_date = advanceDueDate(...)
//   2. sendPushToHousehold(bill.household_id, `${bill.name} is due`)
```

### Variable-amount bills

When `recurring_bills.amount IS NULL`, the bill is variable (e.g., electricity). The cron still advances `next_due_date` and still sends a reminder — confirming the amount is now a cosmetic act for display only, not a precondition for rolling the bill forward.

```typescript
// Client: surface variable bills that haven't had an amount entered this cycle.
// Show an amber "Needs amount" badge on the Bills screen.
const pendingVariableBills = recurringBills.filter(b => b.amount === null && b.active)
```

### Worked example — monthly cycle

- Household with 3 members, bill "Rent" $1,500, frequency monthly, `next_due_date = 2026-05-01`.

**On May 1 (cron runs):**
1. `next_due_date` advances: `2026-05-01` → `2026-06-01`.
2. Push fires: "Rent is due — $1,500".
3. No expense is posted. Balances unchanged.

**Through May:**
- Each member pays the landlord directly and taps "Mark paid" in the app, which inserts their `bill_cycle_payments` row for the current cycle.
- The Bills screen shows "2 of 3 paid" until the last member taps.

**On June 1 (cron runs again):**
- Same flow. The May cycle's `bill_cycle_payments` rows stay in place as history; the new cycle starts with zero paid.

---

## Move-Out Math

### Proration rule

When a member moves out mid-cycle, they owe a prorated share for the **days they were present**. The remainder is redistributed among the staying members for the rest of the cycle.

```
days_present   = move_out_date − cycle_start_date + 1  (inclusive of move-out day)
cycle_total    = cycle_end_date − cycle_start_date + 1
prorated_share = full_share × (days_present / cycle_total)
```

The existing `prorateAmount` function handles this — pass `cycleStartDate` as `joinDate` to get the full days-present share:

```typescript
// How much of a $500 recurring bill does Sam owe after moving out May 15?
const daysPresent = differenceInDays(moveOutDate, cycleStartDate) + 1  // 15
const cycleDays   = differenceInDays(cycleEndDate, cycleStartDate) + 1 // 31
const samShare    = parseFloat((500 * daysPresent / cycleDays).toFixed(2))  // $241.94

// Remaining $258.06 split equally between the 2 staying members: $129.03 each
```

**One-time expense proration rule:**
- Expense date ≤ move-out date → original split amount stands (Sam was there)
- Expense date > move-out date → Sam's split = $0 (remove it, redistribute)
- Auto-posted recurring bills → always prorate by days present

### Worked example

- Cycle: May 1–May 31 (31 days). Sam moves out May 15 (15 days present).
- Members: Alex, Jordan, Sam. Equal splits on rent ($500 each).

| Expense | Full Split | Sam's Prorated | Alex & Jordan each |
|---------|-----------|---------------|-------------------|
| Rent (recurring) | $500 | $241.94 | +$129.03 |
| Electricity (recurring) | $45 | $21.77 | +$11.65 |
| Groceries May 10 (one-time) | $30 | $30.00 | — |
| Takeout May 20 (one-time, after move-out) | $25 | $0 | $12.50 |

Sam's total owed this cycle: **$293.71**
Sam paid this cycle: $150.00
**Net: Sam owes household $143.71**

### Move-out flow (4 steps in the app)

```
Step 1 — Pick move-out date      (defaults to today; cannot be before cycle start)
Step 2 — Review prorated costs   (itemized table; show net balance clearly)
Step 3 — Settle up               (Venmo/CashApp deeplinks for the net amount)
Step 4 — Confirm                 (sets member.left_at, generates PDF, marks move_outs.completed_at)
```

### Settlement PDF contents

```
Homesplit — Move-Out Settlement
────────────────────────────────────────────────
Household:      The Maple Street House
Departing:      Sam Torres
Move-out date:  May 15, 2026

BILLING CYCLE: May 1 – May 31, 2026  (15 of 31 days)

Expense                    Full Split    Sam Owes
─────────────────────────────────────────────────
Rent (recurring)             $500.00      $241.94
Electricity (recurring)       $45.00       $21.77
Groceries May 10              $30.00       $30.00
Takeout May 20 (excl.)        $25.00        $0.00
─────────────────────────────────────────────────
Total owed by Sam:                        $293.71
Total paid by Sam:                        $150.00
NET: Sam owes household                   $143.71

Settle via:
  Alex   → Venmo @alexsmith   $71.86
  Jordan → Venmo @jordanl     $71.85
────────────────────────────────────────────────
Generated by Homesplit · homesplit.app
```

PDF path in Supabase Storage: `settlement-pdfs/{household_id}/{move_out_id}.pdf`
