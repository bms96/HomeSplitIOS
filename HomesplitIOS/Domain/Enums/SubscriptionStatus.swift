import Foundation

enum SubscriptionStatus: String, Codable, CaseIterable, Hashable, Sendable {
    case active
    case expired
    case cancelled
    case trial
}
