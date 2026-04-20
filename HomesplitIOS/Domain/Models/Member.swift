import Foundation

struct Member: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let householdId: UUID
    var userId: UUID?
    var displayName: String
    var phone: String?
    var color: String
    var joinedAt: Date
    var leftAt: Date?

    var isActive: Bool { leftAt == nil }

    enum CodingKeys: String, CodingKey {
        case id
        case householdId = "household_id"
        case userId      = "user_id"
        case displayName = "display_name"
        case phone
        case color
        case joinedAt    = "joined_at"
        case leftAt      = "left_at"
    }
}
