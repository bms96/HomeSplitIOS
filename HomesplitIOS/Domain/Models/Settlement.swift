import Foundation

struct Settlement: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let householdId: UUID
    var cycleId: UUID?
    let fromMemberId: UUID
    let toMemberId: UUID
    var amount: Decimal
    var method: SettlementMethod
    var notes: String?
    var settledAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case householdId  = "household_id"
        case cycleId      = "cycle_id"
        case fromMemberId = "from_member_id"
        case toMemberId   = "to_member_id"
        case amount
        case method
        case notes
        case settledAt    = "settled_at"
    }
}
