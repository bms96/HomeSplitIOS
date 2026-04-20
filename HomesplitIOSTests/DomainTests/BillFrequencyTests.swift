import Foundation
import Testing
@testable import Homesplit

@Suite("advanceDueDate — weekly")
struct AdvanceWeeklyTests {
    @Test("adds 7 days in the middle of a month")
    func midMonth() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-05-10", frequency: .weekly) == "2026-05-17")
    }

    @Test("rolls across month boundary")
    func monthBoundary() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-05-28", frequency: .weekly) == "2026-06-04")
    }

    @Test("rolls across year boundary")
    func yearBoundary() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-12-28", frequency: .weekly) == "2027-01-04")
    }
}

@Suite("advanceDueDate — biweekly")
struct AdvanceBiweeklyTests {
    @Test("adds 14 days in the middle of a month")
    func midMonth() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-05-01", frequency: .biweekly) == "2026-05-15")
    }

    @Test("rolls across month boundary")
    func monthBoundary() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-05-20", frequency: .biweekly) == "2026-06-03")
    }

    @Test("handles a leap-year February transition")
    func leapYear() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2028-02-20", frequency: .biweekly) == "2028-03-05")
    }
}

@Suite("advanceDueDate — monthly (end-of-month clamping)")
struct AdvanceMonthlyTests {
    @Test("adds one calendar month for a mid-month date")
    func midMonth() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-05-15", frequency: .monthly) == "2026-06-15")
    }

    @Test("clamps Jan 31 to Feb 28 in a non-leap year")
    func jan31NonLeap() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-01-31", frequency: .monthly) == "2026-02-28")
    }

    @Test("clamps Jan 31 to Feb 29 in a leap year")
    func jan31Leap() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2028-01-31", frequency: .monthly) == "2028-02-29")
    }

    @Test("clamps Mar 31 to Apr 30")
    func mar31() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-03-31", frequency: .monthly) == "2026-04-30")
    }

    @Test("does NOT clamp when target month has enough days")
    func noClamp() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-04-30", frequency: .monthly) == "2026-05-30")
    }

    @Test("rolls across year boundary from December")
    func dec() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-12-15", frequency: .monthly) == "2027-01-15")
    }

    @Test("clamps Dec 31 → Jan 31 preserves the 31st")
    func dec31() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-12-31", frequency: .monthly) == "2027-01-31")
    }

    @Test("drift expected after a clamp — Jan 31 → Feb 28 → Mar 28")
    func drift() throws {
        let feb = try BillFrequencyCalculator.advanceDueDate(iso: "2026-01-31", frequency: .monthly)
        let mar = try BillFrequencyCalculator.advanceDueDate(iso: feb, frequency: .monthly)
        #expect(feb == "2026-02-28")
        #expect(mar == "2026-03-28")
    }
}

@Suite("advanceDueDate — monthlyFirst (pinned to day 1)")
struct AdvanceMonthlyFirstTests {
    @Test("advances day-1 input to day-1 of next month")
    func day1() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-04-01", frequency: .monthlyFirst) == "2026-05-01")
    }

    @Test("normalizes a mid-month input to day 1 of next month")
    func midMonth() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-04-15", frequency: .monthlyFirst) == "2026-05-01")
    }

    @Test("normalizes a last-of-month input to day 1 of next month")
    func lastOfMonth() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-01-31", frequency: .monthlyFirst) == "2026-02-01")
    }

    @Test("rolls across year boundary from December")
    func yearBoundary() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-12-01", frequency: .monthlyFirst) == "2027-01-01")
    }
}

@Suite("advanceDueDate — monthlyLast (pinned to end of month)")
struct AdvanceMonthlyLastTests {
    @Test("advances Apr 30 → May 31")
    func apr30() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-04-30", frequency: .monthlyLast) == "2026-05-31")
    }

    @Test("advances May 31 → Jun 30 (clamps short month)")
    func may31() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-05-31", frequency: .monthlyLast) == "2026-06-30")
    }

    @Test("advances Jan 31 → Feb 28 in a non-leap year")
    func jan31NonLeap() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-01-31", frequency: .monthlyLast) == "2026-02-28")
    }

    @Test("advances Jan 31 → Feb 29 in a leap year")
    func jan31Leap() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2028-01-31", frequency: .monthlyLast) == "2028-02-29")
    }

    @Test("advances Feb 28 → Mar 31 (lands on end-of-March regardless)")
    func feb28() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-02-28", frequency: .monthlyLast) == "2026-03-31")
    }

    @Test("normalizes a mid-month input to end of next month")
    func midMonth() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-04-15", frequency: .monthlyLast) == "2026-05-31")
    }

    @Test("rolls across year boundary from December")
    func yearBoundary() throws {
        #expect(try BillFrequencyCalculator.advanceDueDate(iso: "2026-12-31", frequency: .monthlyLast) == "2027-01-31")
    }
}

@Suite("advanceDueDate — error handling")
struct AdvanceErrorTests {
    @Test("throws on malformed ISO input")
    func throwsOnMalformed() {
        #expect(throws: BillFrequencyError.self) {
            _ = try BillFrequencyCalculator.advanceDueDate(iso: "not-a-date", frequency: .monthly)
        }
        #expect(throws: BillFrequencyError.self) {
            _ = try BillFrequencyCalculator.advanceDueDate(iso: "", frequency: .monthly)
        }
    }

    @Test("output is always zero-padded YYYY-MM-DD format")
    func zeroPadded() throws {
        let result = try BillFrequencyCalculator.advanceDueDate(iso: "2026-01-05", frequency: .weekly)
        #expect(result.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil)
    }
}

@Suite("formatFrequency")
struct FormatFrequencyTests {
    @Test("weekly → Every {day} derived from the next due date")
    func weekly() {
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-20") == "Every Monday")
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-26") == "Every Sunday")
    }

    @Test("biweekly → Every other {day} derived from the next due date")
    func biweekly() {
        #expect(BillFrequencyCalculator.formatFrequency(.biweekly, nextDueDateIso: "2026-04-22") == "Every other Wednesday")
        #expect(BillFrequencyCalculator.formatFrequency(.biweekly, nextDueDateIso: "2026-04-25") == "Every other Saturday")
    }

    @Test("monthly variants are static and ignore the date")
    func monthlyStatic() {
        #expect(BillFrequencyCalculator.formatFrequency(.monthly, nextDueDateIso: "2026-04-22") == "Monthly")
        #expect(BillFrequencyCalculator.formatFrequency(.monthlyFirst, nextDueDateIso: "2026-04-01") == "1st of every month")
        #expect(BillFrequencyCalculator.formatFrequency(.monthlyLast, nextDueDateIso: "2026-04-30") == "Last day of every month")
    }

    @Test("falls back to generic labels on malformed ISO")
    func malformed() {
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "") == "Weekly")
        #expect(BillFrequencyCalculator.formatFrequency(.biweekly, nextDueDateIso: "not-a-date") == "Biweekly")
    }

    @Test("covers all seven days of the week")
    func sevenDays() {
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-19") == "Every Sunday")
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-20") == "Every Monday")
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-21") == "Every Tuesday")
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-22") == "Every Wednesday")
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-23") == "Every Thursday")
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-24") == "Every Friday")
        #expect(BillFrequencyCalculator.formatFrequency(.weekly, nextDueDateIso: "2026-04-25") == "Every Saturday")
    }
}

@Suite("shouldAdvanceBill")
struct ShouldAdvanceBillTests {
    typealias G = BillFrequencyCalculator.AdvanceGuard

    @Test("true when past due and every included member has paid")
    func pastDuePaid() {
        #expect(BillFrequencyCalculator.shouldAdvanceBill(
            G(active: true, daysUntilDue: -2, paidCount: 3, includedCount: 3)) == true)
    }

    @Test("true when due today and fully paid")
    func dueToday() {
        #expect(BillFrequencyCalculator.shouldAdvanceBill(
            G(active: true, daysUntilDue: 0, paidCount: 3, includedCount: 3)) == true)
    }

    @Test("false when due in the future, even if everyone has paid early")
    func dueFuture() {
        #expect(BillFrequencyCalculator.shouldAdvanceBill(
            G(active: true, daysUntilDue: 5, paidCount: 3, includedCount: 3)) == false)
    }

    @Test("false when one member has not paid")
    func oneUnpaid() {
        #expect(BillFrequencyCalculator.shouldAdvanceBill(
            G(active: true, daysUntilDue: -2, paidCount: 2, includedCount: 3)) == false)
    }

    @Test("false when nobody is included")
    func noneIncluded() {
        #expect(BillFrequencyCalculator.shouldAdvanceBill(
            G(active: true, daysUntilDue: -2, paidCount: 0, includedCount: 0)) == false)
    }

    @Test("false when the bill is paused")
    func paused() {
        #expect(BillFrequencyCalculator.shouldAdvanceBill(
            G(active: false, daysUntilDue: -2, paidCount: 3, includedCount: 3)) == false)
    }

    @Test("one-way ratchet: true whether extra payments exist or not")
    func ratchet() {
        let exact = BillFrequencyCalculator.shouldAdvanceBill(
            G(active: true, daysUntilDue: -1, paidCount: 3, includedCount: 3))
        let over = BillFrequencyCalculator.shouldAdvanceBill(
            G(active: true, daysUntilDue: -1, paidCount: 4, includedCount: 3))
        #expect(exact == true)
        #expect(over == true)
    }
}
