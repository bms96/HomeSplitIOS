import Foundation

struct BillingCycle: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let householdId: UUID
    var startDate: Date
    var endDate: Date
    var closedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case householdId = "household_id"
        case startDate   = "start_date"
        case endDate     = "end_date"
        case closedAt    = "closed_at"
    }
}
