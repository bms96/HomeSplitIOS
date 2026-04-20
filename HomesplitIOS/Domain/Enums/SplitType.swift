import Foundation

enum SplitType: String, Codable, CaseIterable, Hashable, Sendable {
    case equal
    case customPercent = "custom_pct"
    case customAmount  = "custom_amt"
}
