import Foundation
import Observation

/// Drives the `EditExpenseView` sheet. Mirrors `AddExpenseViewModel` but is
/// seeded from an existing expense and calls `repository.update` on submit.
///
/// Edits are only legal while no split on the expense has been settled
/// (`ExpenseDetailViewModel.canEdit`), so splits are re-created on every save.
@Observable
@MainActor
final class EditExpenseViewModel {
    var amountText: String
    var description: String
    var category: ExpenseCategory
    var paidByMemberId: UUID?
    var selectedMemberIds: Set<UUID>
    var date: Date
    var dueDate: Date?
    var hasDueDate: Bool

    private(set) var isSubmitting: Bool = false
    private(set) var lastError: String?

    let expenseId: UUID
    private let members: [Member]
    private let repository: any ExpensesRepositoryProtocol

    init(
        expense: ExpenseWithDetails,
        members: [Member],
        repository: any ExpensesRepositoryProtocol
    ) {
        self.expenseId = expense.id
        self.members = members
        self.repository = repository
        self.amountText = Self.formatAmountForEditing(expense.amount)
        self.description = expense.description ?? ""
        self.category = expense.category
        self.paidByMemberId = expense.paidByMemberId
        self.selectedMemberIds = Set(expense.expenseSplits.map(\.memberId))
        self.date = expense.date
        self.dueDate = expense.dueDate
        self.hasDueDate = expense.dueDate != nil
    }

    var activeMembers: [Member] { members.filter(\.isActive) }

    var canSubmit: Bool {
        !isSubmitting
            && parsedAmount != nil
            && paidByMemberId != nil
            && !selectedMemberIds.isEmpty
    }

    var parsedAmount: Decimal? {
        let trimmed = amountText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        guard let value = Decimal(string: trimmed, locale: Locale.current) else { return nil }
        return value > 0 ? value : nil
    }

    func toggleMember(_ id: UUID) {
        if selectedMemberIds.contains(id) {
            selectedMemberIds.remove(id)
        } else {
            selectedMemberIds.insert(id)
        }
    }

    func submit() async -> Bool {
        guard let amount = parsedAmount,
              let paidBy = paidByMemberId,
              !selectedMemberIds.isEmpty
        else { return false }

        isSubmitting = true
        lastError = nil
        defer { isSubmitting = false }

        let input = UpdateExpenseInput(
            id: expenseId,
            paidByMemberId: paidBy,
            amount: amount,
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            category: category,
            date: date,
            dueDate: hasDueDate ? dueDate : nil,
            memberIds: activeMembers
                .map(\.id)
                .filter { selectedMemberIds.contains($0) }
        )
        do {
            _ = try await repository.update(input)
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    private static func formatAmountForEditing(_ amount: Decimal) -> String {
        var value = amount
        var rounded = Decimal()
        NSDecimalRound(&rounded, &value, 2, .plain)
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.usesGroupingSeparator = false
        formatter.locale = Locale.current
        return formatter.string(from: rounded as NSDecimalNumber) ?? "\(rounded)"
    }
}
