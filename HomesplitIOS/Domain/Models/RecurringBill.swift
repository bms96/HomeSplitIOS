import Foundation

struct RecurringBill: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let householdId: UUID
    var name: String
    var amount: Decimal?
    var frequency: BillFrequency
    var nextDueDate: Date
    var active: Bool
    var splitType: SplitType
    var customSplits: [CustomSplit]?

    var isVariable: Bool { amount == nil }

    struct CustomSplit: Codable, Hashable, Sendable {
        let memberId: UUID
        var value: Decimal

        enum CodingKeys: String, CodingKey {
            case memberId = "member_id"
            case value
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case householdId  = "household_id"
        case name
        case amount
        case frequency
        case nextDueDate  = "next_due_date"
        case active
        case splitType    = "split_type"
        case customSplits = "custom_splits"
    }
}
