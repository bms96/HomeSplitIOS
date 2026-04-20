import Foundation

struct ExpenseSplit: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let expenseId: UUID
    let memberId: UUID
    var amountOwed: Decimal
    var settledAt: Date?
    var settlementId: UUID?

    enum CodingKeys: String, CodingKey {
        case id
        case expenseId    = "expense_id"
        case memberId     = "member_id"
        case amountOwed   = "amount_owed"
        case settledAt    = "settled_at"
        case settlementId = "settlement_id"
    }
}
