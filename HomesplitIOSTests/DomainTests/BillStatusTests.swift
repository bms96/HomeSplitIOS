import Foundation
import Testing
@testable import Homesplit

@Suite("isBillFullyPaid")
struct IsBillFullyPaidTests {
    @Test("true when every included member has paid")
    func allPaid() {
        #expect(BillStatus.isBillFullyPaid(paidCount: 3, includedCount: 3) == true)
    }

    @Test("false when one included member has not paid")
    func onePartial() {
        #expect(BillStatus.isBillFullyPaid(paidCount: 2, includedCount: 3) == false)
    }

    @Test("false when nobody has paid")
    func nobody() {
        #expect(BillStatus.isBillFullyPaid(paidCount: 0, includedCount: 3) == false)
    }

    @Test("true when extra payments exist (defensive)")
    func extras() {
        #expect(BillStatus.isBillFullyPaid(paidCount: 4, includedCount: 3) == true)
    }

    @Test("false when nobody is included (vacuous-truth guard)")
    func noneIncluded() {
        #expect(BillStatus.isBillFullyPaid(paidCount: 0, includedCount: 0) == false)
    }

    @Test("false when includedCount is negative (defensive)")
    func negative() {
        #expect(BillStatus.isBillFullyPaid(paidCount: 0, includedCount: -1) == false)
    }
}

@Suite("isBillEffectivelyOverdue")
struct IsBillEffectivelyOverdueTests {
    @Test("false when due date is in the future")
    func future() {
        #expect(BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: 5, paidCount: 0, includedCount: 3
        ) == false)
    }

    @Test("false when due date is today (day 0 is not overdue)")
    func today() {
        #expect(BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: 0, paidCount: 0, includedCount: 3
        ) == false)
    }

    @Test("true when past due and at least one member has not paid")
    func pastDuePartial() {
        #expect(BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: -2, paidCount: 2, includedCount: 3
        ) == true)
    }

    @Test("false when past due but every included member has paid")
    func pastDueFullyPaid() {
        #expect(BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: -2, paidCount: 3, includedCount: 3
        ) == false)
    }

    @Test("false when past due but nobody is included")
    func pastDueNoMembers() {
        #expect(BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: -5, paidCount: 0, includedCount: 0
        ) == false)
    }

    @Test("true when only one member remains unpaid and it is past due")
    func oneRemaining() {
        #expect(BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: -1, paidCount: 3, includedCount: 4
        ) == true)
    }

    @Test("false the instant the last unpaid member pays (past-due edge case)")
    func flipWhenLastPays() {
        let before = BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: -2, paidCount: 2, includedCount: 3
        )
        let after = BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: -2, paidCount: 3, includedCount: 3
        )
        #expect(before == true)
        #expect(after == false)
    }
}
