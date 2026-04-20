import Foundation
import Testing
@testable import Homesplit

@Suite("computeYouOwe")
struct ComputeYouOweTests {
    @Test("positive when count is 0 and nothing carried over")
    func positive() {
        let state = CardState.computeYouOwe(count: 0, hasCarryover: false)
        #expect(state == StatCardState(tone: .positive, text: "All settled up"))
    }

    @Test("caution when count > 0 and no carryover")
    func caution() {
        let state = CardState.computeYouOwe(count: 2, hasCarryover: false)
        #expect(state == StatCardState(tone: .caution, text: "Due this cycle"))
    }

    @Test("alert when carryover exists, regardless of current count")
    func alertOnCarryover() {
        #expect(CardState.computeYouOwe(count: 0, hasCarryover: true).tone == .alert)
        #expect(CardState.computeYouOwe(count: 5, hasCarryover: true).tone == .alert)
    }

    @Test("carryover wins over current-cycle count")
    func carryoverWins() {
        #expect(CardState.computeYouOwe(count: 3, hasCarryover: true).tone == .alert)
        #expect(CardState.computeYouOwe(count: 3, hasCarryover: false).tone == .caution)
    }

    @Test("returns non-empty, screen-reader-friendly text for every state")
    func textLength() {
        let states = [
            CardState.computeYouOwe(count: 0, hasCarryover: false),
            CardState.computeYouOwe(count: 1, hasCarryover: false),
            CardState.computeYouOwe(count: 0, hasCarryover: true),
            CardState.computeYouOwe(count: 1, hasCarryover: true),
        ]
        for s in states {
            #expect(s.text.count > 0)
            #expect(s.text.count <= 40)
        }
    }
}

@Suite("computeOwedToYou")
struct ComputeOwedToYouTests {
    @Test("positive when count is 0 and nothing carried over")
    func positive() {
        let state = CardState.computeOwedToYou(count: 0, hasCarryover: false)
        #expect(state == StatCardState(tone: .positive, text: "Fully reimbursed"))
    }

    @Test("caution when count > 0 and no carryover")
    func caution() {
        let state = CardState.computeOwedToYou(count: 3, hasCarryover: false)
        #expect(state == StatCardState(tone: .caution, text: "Waiting on roommates"))
    }

    @Test("alert when carryover exists, regardless of current count")
    func alertOnCarryover() {
        #expect(CardState.computeOwedToYou(count: 0, hasCarryover: true).tone == .alert)
        #expect(CardState.computeOwedToYou(count: 7, hasCarryover: true).tone == .alert)
    }

    @Test("is deterministic across identical inputs")
    func deterministic() {
        let a = CardState.computeOwedToYou(count: 2, hasCarryover: false)
        let b = CardState.computeOwedToYou(count: 2, hasCarryover: false)
        #expect(a == b)
    }

    @Test("returns non-empty, screen-reader-friendly text for every state")
    func textLength() {
        let states = [
            CardState.computeOwedToYou(count: 0, hasCarryover: false),
            CardState.computeOwedToYou(count: 1, hasCarryover: false),
            CardState.computeOwedToYou(count: 0, hasCarryover: true),
        ]
        for s in states {
            #expect(s.text.count > 0)
            #expect(s.text.count <= 40)
        }
    }
}

@Suite("computeBillsDue")
struct ComputeBillsDueTests {
    @Test("positive when no bills in window and none overdue")
    func positive() {
        let state = CardState.computeBillsDue(count: 0, hasOverdue: false)
        #expect(state == StatCardState(tone: .positive, text: "All caught up"))
    }

    @Test("caution when bills are coming up and none overdue")
    func caution() {
        let state = CardState.computeBillsDue(count: 2, hasOverdue: false)
        #expect(state == StatCardState(tone: .caution, text: "Coming up"))
    }

    @Test("alert when any bill is past due, regardless of count")
    func alert() {
        #expect(CardState.computeBillsDue(count: 1, hasOverdue: true).tone == .alert)
        #expect(CardState.computeBillsDue(count: 5, hasOverdue: true).tone == .alert)
    }

    @Test("alert takes priority over caution")
    func alertPriority() {
        #expect(CardState.computeBillsDue(count: 4, hasOverdue: true).tone == .alert)
    }

    @Test("returns non-empty, screen-reader-friendly text for every state")
    func textLength() {
        let states = [
            CardState.computeBillsDue(count: 0, hasOverdue: false),
            CardState.computeBillsDue(count: 2, hasOverdue: false),
            CardState.computeBillsDue(count: 2, hasOverdue: true),
        ]
        for s in states {
            #expect(s.text.count > 0)
            #expect(s.text.count <= 40)
        }
    }
}

@Suite("card state — shared invariants")
struct CardStateInvariantsTests {
    @Test("every state returns a valid tone enum value")
    func validTones() {
        let valid: Set<CardTone> = [.positive, .caution, .alert]
        let all = [
            CardState.computeYouOwe(count: 0, hasCarryover: false),
            CardState.computeYouOwe(count: 1, hasCarryover: false),
            CardState.computeYouOwe(count: 0, hasCarryover: true),
            CardState.computeOwedToYou(count: 0, hasCarryover: false),
            CardState.computeOwedToYou(count: 1, hasCarryover: false),
            CardState.computeOwedToYou(count: 0, hasCarryover: true),
            CardState.computeBillsDue(count: 0, hasOverdue: false),
            CardState.computeBillsDue(count: 1, hasOverdue: false),
            CardState.computeBillsDue(count: 0, hasOverdue: true),
        ]
        for s in all {
            #expect(valid.contains(s.tone))
        }
    }

    @Test("severity ordering: positive < caution < alert")
    func severity() {
        let order: [CardTone: Int] = [.positive: 0, .caution: 1, .alert: 2]
        let baseline = CardState.computeYouOwe(count: 0, hasCarryover: false)
        let oneSignal = CardState.computeYouOwe(count: 1, hasCarryover: false)
        let twoSignals = CardState.computeYouOwe(count: 1, hasCarryover: true)
        #expect(order[oneSignal.tone]! >= order[baseline.tone]!)
        #expect(order[twoSignals.tone]! >= order[oneSignal.tone]!)
    }
}
