import Foundation
import Testing
@testable import Homesplit

private func d(_ s: String) -> Decimal { Decimal(string: s)! }
private let CYCLE_START = "2026-05-01"
private let CYCLE_END   = "2026-05-31"

@Suite("Proration.cycleTotalDays")
struct CycleTotalDaysTests {
    @Test("counts a full 31-day month inclusively")
    func full31() {
        #expect(Proration.cycleTotalDays(cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END) == 31)
    }

    @Test("counts a 28-day February inclusively")
    func feb28() {
        #expect(Proration.cycleTotalDays(cycleStartIso: "2026-02-01", cycleEndIso: "2026-02-28") == 28)
    }

    @Test("counts a leap-year February inclusively")
    func feb29Leap() {
        #expect(Proration.cycleTotalDays(cycleStartIso: "2028-02-01", cycleEndIso: "2028-02-29") == 29)
    }

    @Test("returns 1 for a same-day cycle")
    func sameDay() {
        #expect(Proration.cycleTotalDays(cycleStartIso: "2026-05-15", cycleEndIso: "2026-05-15") == 1)
    }

    @Test("falls back safely for malformed ISO (both parse to epoch)")
    func malformed() {
        #expect(Proration.cycleTotalDays(cycleStartIso: "", cycleEndIso: "") == 1)
    }
}

@Suite("Proration.daysPresent")
struct DaysPresentTests {
    @Test("returns full cycle length when move-out is the last day")
    func lastDay() {
        #expect(Proration.daysPresent(
            cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: CYCLE_END
        ) == 31)
    }

    @Test("returns full cycle length when move-out is after the cycle end")
    func afterEnd() {
        #expect(Proration.daysPresent(
            cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: "2026-06-15"
        ) == 31)
    }

    @Test("returns 1 when move-out is the same day as cycle start")
    func startDay() {
        #expect(Proration.daysPresent(
            cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: CYCLE_START
        ) == 1)
    }

    @Test("returns 0 when move-out is before cycle start")
    func beforeStart() {
        #expect(Proration.daysPresent(
            cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: "2026-04-20"
        ) == 0)
    }

    @Test("counts mid-cycle move-out inclusively")
    func midCycle() {
        #expect(Proration.daysPresent(
            cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: "2026-05-16"
        ) == 16)
    }
}

@Suite("Proration.prorateAmount")
struct ProrateAmountTests {
    @Test("returns full amount when member is present the entire cycle")
    func fullCycle() {
        #expect(Proration.prorateAmount(
            fullAmount: 900, cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: CYCLE_END
        ) == 900)
    }

    @Test("returns roughly half when moving out near the midpoint")
    func halfCycle() {
        let result = Proration.prorateAmount(
            fullAmount: 900, cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: "2026-05-16"
        )
        let expected = (Decimal(900) * 16 / 31).roundedHalfAwayFromZero(scale: 2)
        #expect(result == expected)
    }

    @Test("returns full amount if move-out is after the cycle end")
    func afterEnd() {
        #expect(Proration.prorateAmount(
            fullAmount: 1200, cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: "2027-01-01"
        ) == 1200)
    }

    @Test("returns 0 when member moved out before the cycle started")
    func before() {
        #expect(Proration.prorateAmount(
            fullAmount: 900, cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: "2026-04-01"
        ) == 0)
    }

    @Test("returns a single-day share when moving out on cycle start day")
    func oneDay() {
        let expected = (Decimal(900) / 31).roundedHalfAwayFromZero(scale: 2)
        let result = Proration.prorateAmount(
            fullAmount: 900, cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: CYCLE_START
        )
        #expect(result == expected)
    }

    @Test("is zero for a $0 bill regardless of days")
    func zeroBill() {
        #expect(Proration.prorateAmount(
            fullAmount: 0, cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: "2026-05-16"
        ) == 0)
    }

    @Test("never exceeds the full amount")
    func neverExceeds() {
        let result = Proration.prorateAmount(
            fullAmount: 500, cycleStartIso: CYCLE_START, cycleEndIso: CYCLE_END, moveOutIso: "2030-01-01"
        )
        #expect(result <= 500)
    }

    @Test("handles leap-year February correctly")
    func leapYear() {
        let result = Proration.prorateAmount(
            fullAmount: 290, cycleStartIso: "2028-02-01", cycleEndIso: "2028-02-29", moveOutIso: "2028-02-15"
        )
        let expected = (Decimal(290) * 15 / 29).roundedHalfAwayFromZero(scale: 2)
        #expect(result == expected)
    }

    @Test("returns 0 defensively when cycle end precedes cycle start")
    func reversedCycle() {
        #expect(Proration.prorateAmount(
            fullAmount: 900, cycleStartIso: "2026-05-31", cycleEndIso: "2026-05-01", moveOutIso: "2026-05-16"
        ) == 0)
    }

    @Test("tolerates malformed ISO strings via epoch fallback — returns finite 0")
    func malformed() {
        #expect(Proration.prorateAmount(
            fullAmount: 100, cycleStartIso: "", cycleEndIso: "", moveOutIso: ""
        ) == 0)
    }

    @Test("tolerates partial ISO strings")
    func partial() {
        let result = Proration.prorateAmount(
            fullAmount: 100, cycleStartIso: "2026", cycleEndIso: "2026-05", moveOutIso: "2026-05-15"
        )
        #expect(result == 0)
    }
}
