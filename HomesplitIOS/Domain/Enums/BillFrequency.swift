import Foundation

enum BillFrequency: String, Codable, CaseIterable, Hashable, Sendable {
    case weekly
    case biweekly
    case monthly
    case monthlyFirst = "monthly_first"
    case monthlyLast  = "monthly_last"
}
