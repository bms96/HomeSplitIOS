import Foundation

struct Expense: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let householdId: UUID
    var cycleId: UUID?
    var paidByMemberId: UUID
    var amount: Decimal
    var description: String?
    var category: ExpenseCategory
    var date: Date
    var dueDate: Date?
    var recurringBillId: UUID?

    enum CodingKeys: String, CodingKey {
        case id
        case householdId      = "household_id"
        case cycleId          = "cycle_id"
        case paidByMemberId   = "paid_by_member_id"
        case amount
        case description
        case category
        case date
        case dueDate          = "due_date"
        case recurringBillId  = "recurring_bill_id"
    }
}
