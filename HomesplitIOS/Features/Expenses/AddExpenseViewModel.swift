import Foundation
import Observation

/// Drives the `AddExpenseView` sheet.
///
/// Matches RN `useAddExpense` semantics: equal-split only at MVP, payer is
/// included in the split set by default (balance math filters payer-self).
@Observable
@MainActor
final class AddExpenseViewModel {
    var amountText: String = ""
    var description: String = ""
    var category: ExpenseCategory = .other
    var paidByMemberId: UUID?
    var selectedMemberIds: Set<UUID> = []
    var date: Date = Date()
    var dueDate: Date?
    var hasDueDate: Bool = false

    private(set) var isSubmitting: Bool = false
    private(set) var lastError: String?

    private let household: MembershipWithHousehold
    private let members: [Member]
    private let cycleId: UUID
    private let repository: any ExpensesRepositoryProtocol

    init(
        household: MembershipWithHousehold,
        members: [Member],
        cycleId: UUID,
        repository: any ExpensesRepositoryProtocol
    ) {
        self.household = household
        self.members = members
        self.cycleId = cycleId
        self.repository = repository
        self.paidByMemberId = household.id
        self.selectedMemberIds = Set(members.map(\.id))
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

        let input = AddExpenseInput(
            householdId: household.householdId,
            cycleId: cycleId,
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
            _ = try await repository.create(input)
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }
}
