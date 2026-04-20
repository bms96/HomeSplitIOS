import Foundation

enum ExpenseCategory: String, Codable, CaseIterable, Hashable, Sendable {
    case rent
    case utilities
    case groceries
    case household
    case food
    case transport
    case other
}
