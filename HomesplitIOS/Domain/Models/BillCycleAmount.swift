import Foundation

struct BillCycleAmount: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let billId: UUID
    let cycleId: UUID
    var amount: Decimal

    enum CodingKeys: String, CodingKey {
        case id
        case billId  = "bill_id"
        case cycleId = "cycle_id"
        case amount
    }
}
