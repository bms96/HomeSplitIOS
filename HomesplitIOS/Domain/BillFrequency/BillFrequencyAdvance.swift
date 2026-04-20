import Foundation

struct BillFrequencyError: Error, CustomStringConvertible, Equatable {
    let message: String
    var description: String { message }
}

enum BillFrequencyCalculator {
    private static let dayNames = [
        "Sunday", "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday",
    ]

    private static var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }

    /// Advance an ISO (YYYY-MM-DD) due date by one unit of the bill's frequency.
    /// Monthly advancement uses end-of-month clamping to match PostgreSQL's
    /// `date + interval '1 month'` semantics: Jan 31 + 1 month = Feb 28, not Mar 3.
    static func advanceDueDate(iso: String, frequency: BillFrequency) throws -> String {
        guard let parts = parseYMD(iso) else {
            throw BillFrequencyError(message: "advanceDueDate: invalid ISO date \"\(iso)\"")
        }
        let (y, m, day) = parts
        let calendar = utcCalendar
        var components = DateComponents(year: y, month: m, day: day)
        components.timeZone = TimeZone(identifier: "UTC")
        guard let date = calendar.date(from: components) else {
            throw BillFrequencyError(message: "advanceDueDate: invalid ISO date \"\(iso)\"")
        }

        let next: Date
        switch frequency {
        case .weekly:
            next = calendar.date(byAdding: .day, value: 7, to: date)!
        case .biweekly:
            next = calendar.date(byAdding: .day, value: 14, to: date)!
        case .monthly, .monthlyFirst, .monthlyLast:
            let nextMonthIndex = m  // 1-based m + 1 (0-based) → m
            let targetYear = y + (nextMonthIndex / 12)
            let targetMonth = (nextMonthIndex % 12) + 1
            let lastDayOfTarget = lastDayOfMonth(year: targetYear, month: targetMonth)
            let targetDay: Int
            switch frequency {
            case .monthlyFirst:
                targetDay = 1
            case .monthlyLast:
                targetDay = lastDayOfTarget
            default:
                targetDay = min(day, lastDayOfTarget)
            }
            var target = DateComponents(year: targetYear, month: targetMonth, day: targetDay)
            target.timeZone = TimeZone(identifier: "UTC")
            next = calendar.date(from: target)!
        }

        return formatIso(date: next, calendar: calendar)
    }

    /// Human-readable cadence label. Weekly and biweekly derive the day-of-week
    /// from `nextDueDateIso` to stay in sync with the advancement schedule.
    static func formatFrequency(_ frequency: BillFrequency, nextDueDateIso: String) -> String {
        switch frequency {
        case .monthly:      return "Monthly"
        case .monthlyFirst: return "1st of every month"
        case .monthlyLast:  return "Last day of every month"
        case .weekly, .biweekly:
            guard let parts = parseYMD(nextDueDateIso) else {
                return frequency == .weekly ? "Weekly" : "Biweekly"
            }
            var components = DateComponents(year: parts.y, month: parts.m, day: parts.d)
            components.timeZone = TimeZone(identifier: "UTC")
            let cal = utcCalendar
            guard let date = cal.date(from: components) else {
                return frequency == .weekly ? "Weekly" : "Biweekly"
            }
            let weekday = cal.component(.weekday, from: date) // 1=Sunday..7=Saturday
            let dayName = dayNames[weekday - 1]
            return frequency == .weekly ? "Every \(dayName)" : "Every other \(dayName)"
        }
    }

    struct AdvanceGuard {
        let active: Bool
        let daysUntilDue: Int
        let paidCount: Int
        let includedCount: Int
    }

    /// Predicate mirroring the SQL trigger's advancement guard.
    static func shouldAdvanceBill(_ params: AdvanceGuard) -> Bool {
        if !params.active { return false }
        if params.daysUntilDue > 0 { return false }
        if params.includedCount <= 0 { return false }
        return params.paidCount >= params.includedCount
    }

    // MARK: - Helpers

    private static func parseYMD(_ iso: String) -> (y: Int, m: Int, d: Int)? {
        let parts = iso.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let y = Int(parts[0]), y > 0,
              let m = Int(parts[1]), m > 0,
              let d = Int(parts[2]), d > 0
        else { return nil }
        return (y, m, d)
    }

    private static func lastDayOfMonth(year: Int, month: Int) -> Int {
        let cal = utcCalendar
        var components = DateComponents(year: year, month: month, day: 1)
        components.timeZone = TimeZone(identifier: "UTC")
        guard let first = cal.date(from: components),
              let range = cal.range(of: .day, in: .month, for: first)
        else { return 31 }
        return range.count
    }

    private static func formatIso(date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        let y = parts.year ?? 1970
        let m = parts.month ?? 1
        let d = parts.day ?? 1
        return String(format: "%04d-%02d-%02d", y, m, d)
    }
}
