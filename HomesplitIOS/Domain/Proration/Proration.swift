import Foundation

enum Proration {
    private static let isoDatePattern = #"^\d{4}-\d{2}-\d{2}$"#
    private static let secondsPerDay: TimeInterval = 86_400

    /// Days a member was present in a cycle, inclusive of both endpoints.
    /// Returns 0 if move-out is before cycle start.
    static func daysPresent(
        cycleStartIso: String,
        cycleEndIso: String,
        moveOutIso: String
    ) -> Int {
        let start = parseIso(cycleStartIso)
        let end = parseIso(cycleEndIso)
        let move = parseIso(moveOutIso)
        if move < start { return 0 }
        let last = move > end ? end : move
        let seconds = last.timeIntervalSince(start)
        return Int(floor(seconds / secondsPerDay)) + 1
    }

    static func cycleTotalDays(cycleStartIso: String, cycleEndIso: String) -> Int {
        let start = parseIso(cycleStartIso)
        let end = parseIso(cycleEndIso)
        let seconds = end.timeIntervalSince(start)
        return Int(floor(seconds / secondsPerDay)) + 1
    }

    /// Prorate a full amount by the days-present fraction. Rounded to cents.
    static func prorateAmount(
        fullAmount: Decimal,
        cycleStartIso: String,
        cycleEndIso: String,
        moveOutIso: String
    ) -> Decimal {
        guard isValidIso(cycleStartIso),
              isValidIso(cycleEndIso),
              isValidIso(moveOutIso)
        else { return 0 }

        let present = daysPresent(
            cycleStartIso: cycleStartIso,
            cycleEndIso: cycleEndIso,
            moveOutIso: moveOutIso
        )
        let total = cycleTotalDays(cycleStartIso: cycleStartIso, cycleEndIso: cycleEndIso)
        if total <= 0 { return 0 }
        return (fullAmount * Decimal(present) / Decimal(total))
            .roundedHalfAwayFromZero(scale: 2)
    }

    static func isValidIso(_ iso: String) -> Bool {
        iso.range(of: isoDatePattern, options: .regularExpression) != nil
    }

    static func parseIso(_ iso: String) -> Date {
        guard isValidIso(iso) else { return Date(timeIntervalSince1970: 0) }
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Date(timeIntervalSince1970: 0) }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        components.timeZone = TimeZone(identifier: "UTC")
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar.date(from: components) ?? Date(timeIntervalSince1970: 0)
    }
}
