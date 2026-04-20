# Homesplit iOS — Testing

> Same philosophy as the RN build: test what loses users' trust if it breaks. Skip
> what slows you down without adding safety. Solo-dev MVP — be honest about what's
> worth testing.

---

## Stack

- **Swift Testing** (primary) — iOS 17+. `@Test`, `#expect`, `#require`.
- **XCTest** — UI tests only, because `XCUITest` isn't available in Swift Testing
  yet.
- **Fixtures** — JSON snapshots of Supabase responses checked into
  `HomesplitIOSTests/Fixtures/`.
- **Local Supabase** — `supabase start` for P2 integration tests against the real
  RLS + RPC behavior.

Run:

```bash
# All unit tests
xcodebuild -scheme HomesplitIOS test \
  -destination 'platform=iOS Simulator,name=iPhone 16'

# Just the Domain target
xcodebuild test -scheme HomesplitIOS -only-testing:HomesplitIOSTests/DomainTests

# Coverage report
xcodebuild test -scheme HomesplitIOS -enableCodeCoverage YES
xcrun xccov view --report --files-for-target HomesplitIOS <path-to-xcresult>
```

---

## Priorities

### P1 — ship blocker (before TestFlight)

**100% coverage on `Domain/`:** splits, debts, proration, bill frequency, bill
status, card state, money helpers, deeplink builders.

These are pure Swift. No Supabase, no SwiftUI, no async. Port the tests from
`utils/*.test.ts` case-by-case — same assertions, adapted to Swift Testing.

#### Example: `DomainTests/SplitsTests.swift`

```swift
import Testing
@testable import Homesplit   // or the Domain target if split out

struct SplitsTests {
    @Test("equal split between two members sums to total")
    func twoEqualMembers() throws {
        let a = UUID(), b = UUID()
        let splits = try Splits.calculateEqualSplits(amount: Decimal(100), memberIDs: [a, b])
        #expect(splits.map(\.amountOwed).reduce(0, +) == Decimal(100))
        #expect(splits[0].amountOwed == Decimal(50))
        #expect(splits[1].amountOwed == Decimal(50))
    }

    @Test("rounding remainder assigned to first member")
    func roundingRemainder() throws {
        let ids = [UUID(), UUID(), UUID()]
        let splits = try Splits.calculateEqualSplits(amount: Decimal(10), memberIDs: ids)
        #expect(splits[0].amountOwed == Decimal(string: "3.34"))
        #expect(splits[1].amountOwed == Decimal(string: "3.33"))
        #expect(splits[2].amountOwed == Decimal(string: "3.33"))
        #expect(splits.map(\.amountOwed).reduce(0, +) == Decimal(10))
    }

    @Test("zero-amount returns zero for every member")
    func zeroAmount() throws {
        let splits = try Splits.calculateEqualSplits(amount: 0, memberIDs: [UUID(), UUID()])
        #expect(splits.allSatisfy { $0.amountOwed == 0 })
    }
}
```

#### Example: `DomainTests/DebtsTests.swift`

```swift
struct DebtsTests {
    @Test("three-person chain: A→B, B→C simplifies to A→C")
    func threeChain() {
        let a = "A", b = "B", c = "C"
        let result = Debts.simplify([
            Debt(from: a, to: b, amount: 50),
            Debt(from: b, to: c, amount: 50)
        ])
        #expect(result.count == 1)
        #expect(result[0].from == a)
        #expect(result[0].to == c)
        #expect(result[0].amount == Decimal(50))
    }

    @Test("mutual debts cancel to a single net edge")
    func mutualCancel() {
        let result = Debts.simplify([
            Debt(from: "A", to: "B", amount: 30),
            Debt(from: "B", to: "A", amount: 20)
        ])
        #expect(result.count == 1)
        #expect(result[0].from == "A")
        #expect(result[0].to == "B")
        #expect(result[0].amount == Decimal(10))
    }
}
```

#### Example: `DomainTests/ProrationTests.swift`

```swift
struct ProrationTests {
    @Test("full amount when joining on cycle start")
    func fullAmountOnStart() {
        let result = Proration.prorate(
            fullAmount: 900,
            cycleStart: "2026-05-01",
            cycleEnd:   "2026-05-31",
            moveOut:    "2026-05-31"
        )
        #expect(result == Decimal(900))
    }

    @Test("half amount when moving out halfway")
    func halfway() {
        let result = Proration.prorate(
            fullAmount: 900,
            cycleStart: "2026-05-01",
            cycleEnd:   "2026-05-31",
            moveOut:    "2026-05-16"
        )
        // 16 days present / 31 total * 900 = 464.52
        #expect(result == Decimal(string: "464.52"))
    }
}
```

**Money math test assertions:**
- Splits always sum exactly to the total (`splits.reduce` equals `amount`).
- Rounding remainder goes to the first member.
- Handle edge cases: $0, single member, mutual cancellation, chains.
- Use `Decimal(string:)` for precise expected values.

---

### P2 — before public launch

**RLS integration tests** against local Supabase. These guard against a bad RLS
policy exposing another household's data to any user.

```bash
# Start local Supabase (Docker required)
supabase start
supabase db push
```

```swift
// HomesplitIOSTests/Integration/RLSTests.swift
struct RLSTests {
    @Test("member cannot read another household's expenses")
    func crossHouseholdExpenses() async throws {
        let eve = try await TestHarness.signedInClient(email: "eve@example.com")
        let result: [ExpenseDTO] = try await eve
            .from("expenses")
            .select()
            .eq("household_id", value: TestHarness.householdAID)
            .execute()
            .value
        #expect(result.isEmpty)  // empty, not error — RLS returns an empty set
    }

    @Test("settle_pair against wrong-household members fails")
    func settleAcrossHouseholds() async throws {
        let eve = try await TestHarness.signedInClient(email: "eve@example.com")
        await #expect(throws: (any Error).self) {
            _ = try await eve.rpc("settle_pair", params: [
                "p_household_id": TestHarness.householdAID,
                "p_from_member_id": TestHarness.aliceID,
                "p_to_member_id":   TestHarness.bobID,
                "p_amount": 5
            ]).execute()
        }
    }
}
```

**Harness requirements:**
- `TestHarness.signedInClient(email:)` — creates a Supabase client with a known
  test JWT.
- `TestHarness.seedHouseholds()` in a `beforeAll`-equivalent (run once per test
  plan, not per test).
- Per-test isolation by unique UUIDs — don't rely on truncating tables between
  tests.

**Scenarios to cover (mirrors `.claude/docs/e2e-scenarios.md` from the RN repo):**
1. Expense → balance → settle-up (round-trip through `settle_pair`).
2. Payer's self-split never shows as "unpaid" in any derived query.
3. Recurring bill lifecycle: cron advance + mark-paid + toggle off.
4. Bill payments don't leak into the debt graph.
5. Invite → join → new expense includes the joiner.
6. Move-out proration matches the hand-worked example
   (`docs/ios/patterns.md`).
7. Paywall gate triggers at exactly the three documented thresholds.
8. RLS cross-household isolation under real writes.

---

### P3 — write when the relevant bug happens, not before

- **ViewModel state machine tests**: `AddExpenseViewModel` moves `idle → saving →
  saved` on success, `idle → saving → failed` on error. Use a fake repository.
- **Paywall gate decision tests**: feed `PaywallGate.allows(_:)` each trigger +
  subscription state, assert decisions.
- **Move-out preview** calculation — large numerical surface, worth a scenario
  test once implemented.

Skip by default:
- ❌ Snapshot tests (SwiftUI previews are the review tool — snapshots rot fast).
- ❌ Exhaustive `XCUITest` flows — one smoke launch test, maybe a sign-in-tap-
  test. Detox-equivalent paranoia is not worth solo-dev time.
- ❌ View-level render tests. If `Text("Add expense")` changes, you'll see it.
- ❌ Supabase SDK behavior. Trust the SDK.

---

## Test plan layout

```
HomesplitIOSTests/
├── DomainTests/            # P1 — pure Swift, fast, no async
│   ├── SplitsTests.swift
│   ├── DebtsTests.swift
│   ├── ProrationTests.swift
│   ├── BillFrequencyTests.swift
│   ├── BillStatusTests.swift
│   ├── CardStateTests.swift
│   ├── CurrencyTests.swift
│   └── DeeplinksTests.swift
├── Integration/            # P2 — needs local Supabase running
│   ├── RLSTests.swift
│   ├── SettlePairTests.swift
│   ├── MoveOutTests.swift
│   └── BillCycleTests.swift
├── ViewModels/             # P3 — fake repos, assert state transitions
│   ├── AddExpenseViewModelTests.swift
│   └── PaywallGateTests.swift
└── Fixtures/
    └── expense_with_splits.json
```

Two test plans in the Xcode scheme:

- **Unit** — `DomainTests` + `ViewModels`. Runs on every PR. Fast (< 10s).
- **Integration** — `Integration`. Runs locally (needs `supabase start`) and on a
  nightly CI job, never on PR.

---

## Fixtures

Decoding real Supabase JSON is a common source of bugs (snake_case vs.
camelCase, date formats, nullable fields). Check in one fixture per DTO.

```swift
@Test("ExpenseDTO decodes from a real Supabase select response")
func expenseDTODecode() throws {
    let data = try loadFixture("expense_with_splits.json")
    let dto = try JSONDecoder.supabase.decode(ExpenseDTO.self, from: data)
    #expect(dto.amount == Decimal(string: "47.50"))
    #expect(dto.splits.count == 3)
}
```

The `JSONDecoder.supabase` static should match the exact date format and
key-decoding strategy the real client uses.

---

## Coverage targets

| Module | Target | Notes |
|---|---|---|
| `Domain/Splits` | 100% | Money math |
| `Domain/Debts` | 100% | Money math |
| `Domain/Proration` | 100% | Money math |
| `Domain/BillFrequency` | 100% | Date math |
| `Domain/BillStatus` | 100% | Pure predicates |
| `Domain/CardState` | 100% | Pure predicates |
| `Domain/Money` | 100% | Parsing / formatting |
| `Domain/Deeplinks` | ≥ 90% | URL building |
| `Core/Supabase/Repositories` | ≥ 60% (per-repo DTO decode) | Just the decoder + URL shape |
| `Features/*` | none required | ViewModel tests only where logic is complex |

0% coverage on a UI view is fine if the view is all layout. 0% coverage on a
money-math file is not acceptable.

---

## What CI should run on PR

1. `swift-format lint` (or SwiftFormat) — fail on style violations.
2. `xcodebuild` with the **Unit** test plan.
3. (Optional) `swiftlint` if we add it.

What CI should **not** run on PR: the Integration plan (requires Supabase Docker)
and XCUITests (slow, flaky).

---

## Referenced files

- `.claude/docs/ios/architecture.md` — testing seams are explained here.
- `.claude/docs/ios/patterns.md` — DTOs, repositories, view models (what you'll
  be testing).
- `.github/instructions/testing-swift.instructions.md` — per-file rules.
