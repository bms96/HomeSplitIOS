---
description: "Use when writing or modifying domain logic: money math, split calculations, debt simplification, proration, currency formatting, bill frequency, or deeplink builders. Pure Swift, no UI."
applyTo: "HomesplitIOS/Domain/**, Packages/HomesplitDomain/**"
---

# Money Math & Domain Logic (Swift)

## Critical Rules
- **`Decimal` only** for currency. Never `Double`, never `Float`.
  Parse user input via `Decimal(string: input, locale: .current)`,
  not `Double(input)`.
- **Splits sum exactly to amount.** First member absorbs the rounding
  remainder. The invariant is testable — write a test that sums every
  output and asserts equality to the input.
- `Domain/` imports **only `Foundation`**. No `SwiftUI`, no `UIKit`,
  no `Supabase`. This must compile on Linux.
- Money values stored on the server are dollars-as-decimal (`47.50`),
  not cents. Match that when constructing payloads.

## Equal Split Pattern
```swift
public enum Splits {
    public static func calculateEqualSplits(
        amount: Decimal, memberIDs: [UUID]
    ) -> [(memberID: UUID, amountOwed: Decimal)] {
        guard !memberIDs.isEmpty else { return [] }
        let count = Decimal(memberIDs.count)
        let base = (amount / count).rounded(2, .down)
        let remainder = amount - base * count
        return memberIDs.enumerated().map { i, id in
            (id, i == 0 ? base + remainder : base)
        }
    }
}

extension Decimal {
    func rounded(_ scale: Int, _ mode: NSDecimalNumber.RoundingMode) -> Decimal {
        var input = self, output = Decimal()
        NSDecimalRound(&output, &input, scale, mode)
        return output
    }
}
```

## Debt Simplification
- Greedy creditor/debtor matching, threshold `Decimal(string: "0.01")!`.
- Pure function: `simplifyDebts([Debt]) -> [Debt]`. Deterministic order
  (sort inputs by member id before matching) so tests are stable.
- Run client-side after fetching unsettled splits; don't ask the server
  to simplify.

## Proration (Mid-Cycle Move-Out)
```swift
public enum Proration {
    public static func prorate(
        fullAmount: Decimal,
        cycleStart: Date, cycleEnd: Date, moveOut: Date,
        calendar: Calendar = .iso8601, timeZone: TimeZone
    ) -> Decimal {
        let totalDays    = days(from: cycleStart, to: cycleEnd, in: calendar, tz: timeZone)
        let presentDays  = days(from: cycleStart, to: moveOut,  in: calendar, tz: timeZone)
        guard totalDays > 0 else { return 0 }
        let ratio = Decimal(presentDays) / Decimal(totalDays)
        return (fullAmount * ratio).rounded(2, .plain)
    }
}
```
- Always pass the household timezone — `households.timezone` is the IANA
  name. Don't rely on UTC.

## Bill Frequency
- `advanceDueDate(from:by:)` for `weekly | biweekly | monthly | monthly_first | monthly_last`.
- Monthly variants use **end-of-month clamping** (Jan 31 → Feb 28). Match
  the SQL trigger in migration 014. Never use naive `Date.setMonth(+1)`
  semantics that overflow.
- All date math goes through `Calendar(identifier: .gregorian)` with the
  household's `TimeZone` injected — no implicit `.current`.

## Currency Display
- Format with `amount.formatted(.currency(code: "USD"))`. Never string
  interpolation.
- For negative-emphasis (you owe vs owed to you), use the
  `.signDisplay(.never)` variant and add the sign via copy/color in the
  view layer, not the formatter.

## Deeplinks (Venmo / CashApp)
- Use `amount.formatted(.number.precision(.fractionLength(2)).grouping(.never))`
  for amounts in URL query strings (no commas, exactly 2 decimals).
- Build URLs with `URLComponents` + `URLQueryItem`. Never hand-concatenate.
- No in-app payment processing — deeplinks only (scope guard).

## Payer-Self-Split Filter
Any function that consumes `[ExpenseSplit]` for debt or "is this paid"
purposes must skip splits where `split.memberID == expense.paidByMemberID`.
Centralize as `expense.outstandingSplits` so the filter is in one place.

## Don't
- ❌ Don't import `SwiftUI` or `UIKit` in `Domain/`.
- ❌ Don't use `NumberFormatter` for parsing — `Decimal(string:locale:)` is
  faster, allocation-free, and matches user-locale separators.
- ❌ Don't store money in cents (`Int`) — server is dollars-decimal.
- ❌ Don't use `Date.timeIntervalSince` for day counts — use
  `Calendar.dateComponents([.day], from:to:)`.

See `.claude/docs/ios/patterns.md` and `.claude/docs/ios/testing.md` for
full implementations and the assertion patterns.
