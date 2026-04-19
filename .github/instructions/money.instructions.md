---
description: "Use when writing or modifying money math, split calculations, debt simplification, proration, currency formatting, or deeplink builders. Covers rounding rules, split sum accuracy, and the debt simplification algorithm."
applyTo: "utils/**"
---

# Money Math & Business Logic

## Critical Rules
- Always use `toFixed(2)` and `parseFloat()` — never raw floating point arithmetic
- Splits must always sum exactly to the expense amount
- First member absorbs rounding remainder (rounding absorber pattern)
- `expenses.amount` is in dollars as a decimal (e.g., `47.50`), not cents

## Equal Split Pattern
```typescript
export function calculateEqualSplits(amount: number, memberIds: string[]) {
  const base = Math.floor((amount / memberIds.length) * 100) / 100
  const remainder = parseFloat((amount - base * memberIds.length).toFixed(2))
  return memberIds.map((id, i) => ({
    member_id: id,
    amount_owed: i === 0 ? parseFloat((base + remainder).toFixed(2)) : base,
  }))
}
```

## Debt Simplification
- Reduces N debts to minimum transactions
- Run client-side in `utils/debts.ts`
- Uses greedy creditor/debtor matching with 0.01 threshold

## Proration (Mid-Cycle Join)
```typescript
export function prorateAmount(
  fullAmount: number, cycleStartDate: Date, cycleEndDate: Date, joinDate: Date
): number {
  const totalDays = differenceInDays(cycleEndDate, cycleStartDate)
  const remainingDays = differenceInDays(cycleEndDate, joinDate)
  return parseFloat(((fullAmount * remainingDays) / totalDays).toFixed(2))
}
```

## Currency Display
Always format with: `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
Never use template literals like `` `$${amount}` ``

## Deeplinks (Venmo / CashApp)
- Use `amount.toFixed(2)` in deeplink URLs
- Always `encodeURIComponent()` the note parameter
- No in-app payment processing — deeplinks only (scope guard)

## Zod Form Schemas
- Define in the same file as the form component, or in `utils/schemas.ts` if shared
- Amount fields: validate as string, refine with `parseFloat() > 0`
- Member IDs: always `z.string().uuid()`

See `docs/patterns.md` for full implementation code of debts, splits, proration, and deeplinks.
