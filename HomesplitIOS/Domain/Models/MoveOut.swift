import Foundation

struct MoveOut: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let householdId: UUID
    let departingMemberId: UUID
    var moveOutDate: Date
    var proratedDaysPresent: Int
    var cycleTotalDays: Int
    var settlementAmount: Decimal
    var settlementId: UUID?
    var pdfUrl: String?
    var completedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case householdId         = "household_id"
        case departingMemberId   = "departing_member_id"
        case moveOutDate         = "move_out_date"
        case proratedDaysPresent = "prorated_days_present"
        case cycleTotalDays      = "cycle_total_days"
        case settlementAmount    = "settlement_amount"
        case settlementId        = "settlement_id"
        case pdfUrl              = "pdf_url"
        case completedAt         = "completed_at"
    }
}
