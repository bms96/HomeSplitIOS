import Foundation

enum SettlementMethod: String, Codable, CaseIterable, Hashable, Sendable {
    case venmo
    case cashapp
    case cash
    case other
}
