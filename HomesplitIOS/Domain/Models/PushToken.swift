import Foundation

struct PushToken: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    var token: String
    var platform: String
    var createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId    = "user_id"
        case token
        case platform
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
