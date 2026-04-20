import Foundation

struct Household: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var address: String?
    var cycleStartDay: Int
    var inviteToken: String
    var timezone: String
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case address
        case cycleStartDay = "cycle_start_day"
        case inviteToken   = "invite_token"
        case timezone
        case createdAt     = "created_at"
    }
}
