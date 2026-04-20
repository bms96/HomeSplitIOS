import Foundation
import Observation

/// Drives `ExpensesView`. Loads the current open cycle and its expenses.
@Observable
@MainActor
final class ExpensesListViewModel {
    private(set) var cycle: BillingCycle?
    private(set) var expenses: [ExpenseWithDetails] = []
    private(set) var members: [Member] = []
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?

    private let expensesRepository: any ExpensesRepositoryProtocol
    private let householdsRepository: any HouseholdRepositoryProtocol

    init(
        expensesRepository: any ExpensesRepositoryProtocol,
        householdsRepository: any HouseholdRepositoryProtocol
    ) {
        self.expensesRepository = expensesRepository
        self.householdsRepository = householdsRepository
    }

    func load(householdId: UUID) async {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            async let cycleTask = expensesRepository.currentCycle(householdId: householdId)
            async let membersTask = householdsRepository.members(householdId: householdId)
            let (loadedCycle, loadedMembers) = try await (cycleTask, membersTask)
            cycle = loadedCycle
            members = loadedMembers
            if let cycleId = loadedCycle?.id {
                expenses = try await expensesRepository.list(
                    householdId: householdId,
                    cycleId: cycleId
                )
            } else {
                expenses = []
            }
        } catch {
            lastError = error.localizedDescription
        }
    }
}
