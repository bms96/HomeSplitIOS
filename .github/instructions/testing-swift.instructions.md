---
description: "Use when writing or modifying Swift tests — Swift Testing for unit + integration, XCTest for UI smoke. Covers priorities, fixtures, and what to skip."
applyTo: "HomesplitIOSTests/**, HomesplitIOSUITests/**, Packages/**/Tests/**"
---

# Testing (Swift Testing + XCTest)

## Priorities
- **P1 (ship blocker):** 100% coverage on `Domain/` — `Splits`, `Debts`,
  `Proration`, `BillFrequency`, `BillStatus`, `CardState`, `Money`,
  `Deeplinks`. Pure, fast, no async.
- **P2 (before launch):** RLS integration tests against a local Supabase
  instance (`supabase start`) covering the eight scenarios in
  `.claude/docs/ios/testing.md`.
- **P3 (only when complex):** ViewModel state-machine tests (paywall gate,
  add-expense validation, move-out preview) using a fake repository.
- **Skip:** snapshot tests, exhaustive XCUITest flows, "renders a Text" tests.

## Stack
- **Swift Testing** for new tests — `import Testing`, `@Test`, `#expect`,
  `#require`. iOS 17+ ready.
- **XCTest** only for `XCUITest` smoke tests (Swift Testing doesn't yet
  support XCUI).
- Fixtures: JSON snapshots of real Supabase responses checked into
  `HomesplitIOSTests/Fixtures/`. Re-capture when the schema changes.

## Domain Test Shape
```swift
import Testing
@testable import Homesplit

struct SplitsTests {
    @Test("equal split sums exactly to total")
    func sumExact() throws {
        let ids = (0..<3).map { _ in UUID() }
        let splits = Splits.calculateEqualSplits(amount: 10, memberIDs: ids)
        #expect(splits.map(\.amountOwed).reduce(0, +) == Decimal(10))
    }

    @Test("rounding remainder goes to first member")
    func remainderToFirst() throws {
        let ids = (0..<3).map { _ in UUID() }
        let splits = Splits.calculateEqualSplits(amount: 10, memberIDs: ids)
        #expect(splits[0].amountOwed == Decimal(string: "3.34"))
        #expect(splits[1].amountOwed == Decimal(string: "3.33"))
    }
}
```

## Money Math Assertions
- Splits always sum exactly to the total.
- Use `Decimal(string: "...")` for expected values — never `Decimal(3.34)`
  (binary `Double` literal coercion).
- Cover edges: `0` amount, single member, mutual cancellation, three-chain.

## Integration (P2)
- Run on a nightly CI job, not on PR. Requires `supabase start` (Docker).
- Per-test isolation by **unique UUIDs** seeded in test setup. Don't
  truncate tables between tests.
- Test the negative path explicitly — assert that a cross-household read
  returns an empty set (RLS) or throws (RPC).

```swift
@Test("member cannot read another household's expenses")
func crossHouseholdIsolation() async throws {
    let eve = try await TestHarness.signedInClient(email: "eve@example.com")
    let rows: [ExpenseDTO] = try await eve.from("expenses")
        .select().eq("household_id", value: TestHarness.householdAID)
        .execute().value
    #expect(rows.isEmpty)   // empty, not error — RLS returns empty
}
```

## ViewModel Tests (P3)
- Inject a fake repository conforming to the protocol; assert state
  transitions (`idle → saving → saved` / `saving → failed`).
- Tests that touch `@MainActor` view models must be `@MainActor` themselves.

## What CI Runs on PR
1. `swift-format lint` (or SwiftFormat) — fail on style violations.
2. `xcodebuild test -only-testing:.../DomainTests` (the **Unit** plan).

What CI does **not** run on PR: Integration plan (Docker), XCUITests
(slow + flaky).

## Fixtures
- One JSON file per DTO shape. Load via a `loadFixture(_:)` helper.
- Re-record when adding a column to the relevant table. Don't hand-edit
  to keep snapshots accurate.

## Don't
- ❌ Don't write snapshot tests for SwiftUI views.
- ❌ Don't mock the Supabase SDK — fake the repository protocol instead.
- ❌ Don't share state across tests via globals or singletons.
- ❌ Don't sleep (`Task.sleep`) to wait for state — use `await` on the
  actual signal.

See `.claude/docs/ios/testing.md` for the full priority breakdown,
scenario catalogue, and coverage targets.
