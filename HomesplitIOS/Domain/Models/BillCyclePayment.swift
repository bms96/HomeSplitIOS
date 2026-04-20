import Foundation

struct BillCyclePayment: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let billId: UUID
    let cycleId: UUID
    let memberId: UUID
    var settledAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case billId    = "bill_id"
        case cycleId   = "cycle_id"
        case memberId  = "member_id"
        case settledAt = "settled_at"
    }
}
