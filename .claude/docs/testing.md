# Homesplit — Testing Strategy

> Referenced from `CLAUDE.md`. Read this file when writing tests, setting up Jest, or working on test infrastructure.

---

## Philosophy for a Solo Developer
Test the things that lose users trust if they break. Skip the things that slow you down without adding safety. At MVP, that means unit testing all money math before shipping, integration testing RLS before launch, and deferring everything else until you have traction.

## Testing Stack
```bash
# Already included with Expo — no extra install needed for Jest
npx expo install jest-expo @testing-library/react-native @testing-library/jest-native
```

## jest.config.js
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*)',
  ],
}
```

---

## Priority 1 — Unit Test These Before Shipping Anything (Non-Negotiable)

These three files contain money math. A bug here means users see wrong balances. Write these tests first, before building any UI.

### `utils/debts.test.ts`
```typescript
import { simplifyDebts } from './debts'

describe('simplifyDebts', () => {
  it('handles two-person debt', () => {
    const result = simplifyDebts([{ from: 'A', to: 'B', amount: 50 }])
    expect(result).toEqual([{ from: 'A', to: 'B', amount: 50 }])
  })

  it('cancels out mutual debts', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 30 },
      { from: 'B', to: 'A', amount: 20 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ from: 'A', to: 'B', amount: 10 })
  })

  it('simplifies three-person chain (A owes B, B owes C → A owes C)', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 50 },
      { from: 'B', to: 'C', amount: 50 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ from: 'A', to: 'C', amount: 50 })
  })

  it('returns empty array when all debts cancel out', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 25 },
      { from: 'B', to: 'A', amount: 25 },
    ])
    expect(result).toHaveLength(0)
  })

  it('handles four people with multiple debts', () => {
    const debts = [
      { from: 'A', to: 'B', amount: 40 },
      { from: 'C', to: 'B', amount: 20 },
      { from: 'A', to: 'D', amount: 10 },
    ]
    const result = simplifyDebts(debts)
    expect(result.length).toBeLessThanOrEqual(3)
    const totalOwed = result.reduce((sum, d) => sum + d.amount, 0)
    expect(totalOwed).toBeCloseTo(70, 2)
  })
})
```

### `utils/splits.test.ts`
```typescript
import { calculateEqualSplits } from './splits'

describe('calculateEqualSplits', () => {
  it('splits evenly between two members', () => {
    const splits = calculateEqualSplits(100, ['A', 'B'])
    expect(splits[0].amount_owed + splits[1].amount_owed).toBeCloseTo(100, 2)
    expect(splits[0].amount_owed).toBeCloseTo(50, 2)
  })

  it('handles rounding — splits always sum to total', () => {
    const splits = calculateEqualSplits(10, ['A', 'B', 'C'])
    const total = splits.reduce((sum, s) => sum + s.amount_owed, 0)
    expect(total).toBeCloseTo(10, 2)
  })

  it('assigns rounding remainder to first member', () => {
    const splits = calculateEqualSplits(10, ['A', 'B', 'C'])
    expect(splits[0].amount_owed).toBe(3.34)
    expect(splits[1].amount_owed).toBe(3.33)
    expect(splits[2].amount_owed).toBe(3.33)
  })

  it('handles $0 expense', () => {
    const splits = calculateEqualSplits(0, ['A', 'B'])
    expect(splits.every(s => s.amount_owed === 0)).toBe(true)
  })

  it('handles single member (payer owes themselves nothing)', () => {
    const splits = calculateEqualSplits(50, ['A'])
    expect(splits[0].amount_owed).toBe(50)
  })
})
```

### `utils/proration.test.ts`
```typescript
import { prorateAmount } from './proration'

describe('prorateAmount', () => {
  it('returns full amount when joining on cycle start', () => {
    const cycleStart = new Date('2026-05-01')
    const cycleEnd   = new Date('2026-05-31')
    const joinDate   = new Date('2026-05-01')
    expect(prorateAmount(900, cycleStart, cycleEnd, joinDate)).toBeCloseTo(900, 2)
  })

  it('returns half amount when joining halfway through', () => {
    const cycleStart = new Date('2026-05-01')
    const cycleEnd   = new Date('2026-05-31')
    const joinDate   = new Date('2026-05-16')
    const result = prorateAmount(900, cycleStart, cycleEnd, joinDate)
    expect(result).toBeCloseTo(450, 0)
  })

  it('returns near-zero when joining on last day', () => {
    const cycleStart = new Date('2026-05-01')
    const cycleEnd   = new Date('2026-05-31')
    const joinDate   = new Date('2026-05-30')
    const result = prorateAmount(900, cycleStart, cycleEnd, joinDate)
    expect(result).toBeLessThan(50)
  })
})
```

---

## Priority 2 — Integration Test RLS Before App Store Launch

Run Supabase locally and verify that your Row Level Security policies actually work. One misconfigured RLS policy can expose every household's financial data to any user.

> **Scenario-level coverage:** for tests that exercise full user flows (expense → balance → settle, bill cron + mark-paid, move-out proration, cross-household RLS under real writes), see `docs/e2e-scenarios.md`. That doc uses the same local-Supabase harness described below, scaled up to full flows. It is **not** device-level E2E — Detox / Maestro remain out of scope.

```bash
# Start local Supabase (Docker required)
npx supabase start

# Run your migrations locally
npx supabase db push
```

```typescript
// supabase/tests/rls.test.ts
// Use two separate Supabase clients authenticated as different users

import { createClient } from '@supabase/supabase-js'

const LOCAL_URL = 'http://localhost:54321'
const ANON_KEY  = 'your-local-anon-key'

async function clientAs(userId: string) {
  return createClient(LOCAL_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${testTokenForUser(userId)}` } }
  })
}

describe('RLS: households', () => {
  it('member cannot read a household they do not belong to', async () => {
    const client = await clientAs('user-from-household-A')
    const { data, error } = await client
      .from('households')
      .select('*')
      .eq('id', 'household-B-id')
    expect(data).toHaveLength(0)
  })

  it('member can read their own household', async () => {
    const client = await clientAs('user-from-household-A')
    const { data } = await client
      .from('households')
      .select('*')
      .eq('id', 'household-A-id')
    expect(data).toHaveLength(1)
  })
})

describe('RLS: expenses', () => {
  it('member cannot read expenses from another household', async () => {
    const client = await clientAs('user-from-household-A')
    const { data } = await client
      .from('expenses')
      .select('*')
      .eq('household_id', 'household-B-id')
    expect(data).toHaveLength(0)
  })
})
```

---

## Priority 3 — Component Tests (Only for Complex UI Logic)

Only write component tests when there is conditional rendering logic that is genuinely hard to verify by eye. Don't write snapshot tests — they break constantly and add no value.

```typescript
// Good candidate: paywall gate component
import { render, fireEvent } from '@testing-library/react-native'
import { AddMemberButton } from '@/components/household/AddMemberButton'

it('shows paywall when free household has 2 members', () => {
  const { getByText } = render(
    <AddMemberButton memberCount={2} isPro={false} onPress={jest.fn()} onPaywall={jest.fn()} />
  )
  fireEvent.press(getByText('Add Member'))
})
```

---

## What NOT to Test at MVP (Defer Until Post-Launch)

| Test Type | Why Skip Now |
|---|---|
| Snapshot tests | Break on every UI change; high maintenance, zero safety value |
| E2E tests (Detox / Maestro) | Slow to set up, flaky on CI, overkill for solo dev pre-launch |
| Navigation flow tests | Expo Router handles routing — trust the framework |
| Every UI component | Low ROI; you'll see rendering bugs in the simulator instantly |
| Supabase query results | Trust Supabase's SDK; test your business logic, not their library |

---

## Running Tests

```bash
# Run all tests
npx jest

# Run a specific file
npx jest utils/debts.test.ts

# Watch mode (re-runs on save — use while writing utils)
npx jest --watch

# Coverage report
npx jest --coverage
```

**Target coverage for MVP:** 100% on `utils/debts.ts`, `utils/splits.ts`, `utils/proration.ts`. 0% on everything else is acceptable at launch — add tests as bugs are reported.
