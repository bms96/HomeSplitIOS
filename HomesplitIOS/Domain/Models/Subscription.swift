import Foundation

struct Subscription: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let householdId: UUID
    var status: SubscriptionStatus
    var revenueCatId: String
    var productId: String
    var expiresAt: Date?

    var isActive: Bool { status == .active || status == .trial }

    enum CodingKeys: String, CodingKey {
        case id
        case householdId = "household_id"
        case status
        case revenueCatId = "revenuecat_id"
        case productId    = "product_id"
        case expiresAt    = "expires_at"
    }
}
