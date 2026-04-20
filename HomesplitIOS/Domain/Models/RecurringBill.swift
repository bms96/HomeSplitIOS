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
    var customSplits: CustomSplits?

    var isVariable: Bool { amount == nil }

    var excludedMemberIds: [UUID] { customSplits?.excludedMemberIds ?? [] }
    var shares: [Share] { customSplits?.shares ?? [] }

    /// JSON blob stored on `recurring_bills.custom_splits`. Matches RN's
    /// `getExcludedMemberIds` / `getShares` readers.
    struct CustomSplits: Codable, Hashable, Sendable {
        var excludedMemberIds: [UUID]
        var shares: [Share]

        init(excludedMemberIds: [UUID] = [], shares: [Share] = []) {
            self.excludedMemberIds = excludedMemberIds
            self.shares = shares
        }

        enum CodingKeys: String, CodingKey {
            case excludedMemberIds = "excluded_member_ids"
            case shares
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            self.excludedMemberIds = (try? container.decode([UUID].self, forKey: .excludedMemberIds)) ?? []
            self.shares = (try? container.decode([Share].self, forKey: .shares)) ?? []
        }
    }

    struct Share: Codable, Hashable, Sendable {
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
