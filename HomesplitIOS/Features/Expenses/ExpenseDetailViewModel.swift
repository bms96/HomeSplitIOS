import Foundation
import Observation

/// Drives `ExpenseDetailView`. Loads a single expense + its splits, refreshes
/// after mark-paid / update, and exposes delete.
@Observable
@MainActor
final class ExpenseDetailViewModel {
    let expenseId: UUID

    private(set) var expense: ExpenseWithDetails?
    private(set) var members: [Member] = []
    private(set) var isLoading: Bool = false
    private(set) var isMarkingPaid: Bool = false
    private(set) var isDeleting: Bool = false
    private(set) var lastError: String?
    private(set) var didDelete: Bool = false

    private let expensesRepository: any ExpensesRepositoryProtocol
    private let householdsRepository: any HouseholdRepositoryProtocol

    init(
        expenseId: UUID,
        expensesRepository: any ExpensesRepositoryProtocol,
        householdsRepository: any HouseholdRepositoryProtocol
    ) {
        self.expenseId = expenseId
        self.expensesRepository = expensesRepository
        self.householdsRepository = householdsRepository
    }

    func load(householdId: UUID) async {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            async let detailTask = expensesRepository.detail(id: expenseId)
            async let membersTask = householdsRepository.members(householdId: householdId)
            let (loadedDetail, loadedMembers) = try await (detailTask, membersTask)
            expense = loadedDetail
            members = loadedMembers
        } catch {
            lastError = error.localizedDescription
        }
    }

    func markMyShareAsPaid(memberId: UUID, householdId: UUID) async {
        guard !isMarkingPaid,
              let mySplit = expense?.expenseSplits.first(where: { $0.memberId == memberId }),
              mySplit.settledAt == nil
        else { return }
        isMarkingPaid = true
        defer { isMarkingPaid = false }
        do {
            try await expensesRepository.markSplitPaid(splitId: mySplit.id)
            await load(householdId: householdId)
        } catch {
            lastError = error.localizedDescription
        }
    }

    func delete() async -> Bool {
        guard !isDeleting else { return false }
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await expensesRepository.delete(id: expenseId)
            didDelete = true
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func anySettled() -> Bool {
        expense?.expenseSplits.contains { $0.settledAt != nil } ?? false
    }

    func isPayer(memberId: UUID) -> Bool {
        expense?.paidByMemberId == memberId
    }

    func canEdit(memberId: UUID) -> Bool {
        isPayer(memberId: memberId) && !anySettled()
    }

    /// Status a split should display: `true` = Paid (either settled or the
    /// payer's own split — the payer never owes themselves).
    func splitIsSettled(_ split: ExpenseSplit) -> Bool {
        if split.settledAt != nil { return true }
        return split.memberId == expense?.paidByMemberId
    }
}
