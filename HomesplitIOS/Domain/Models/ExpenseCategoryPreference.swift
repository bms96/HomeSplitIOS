import Foundation

struct ExpenseCategoryPreference: Codable, Hashable, Sendable {
    let householdId: UUID
    let category: ExpenseCategory
    var hidden: Bool
    var customLabel: String?
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case householdId = "household_id"
        case category
        case hidden
        case customLabel = "custom_label"
        case updatedAt   = "updated_at"
    }
}
