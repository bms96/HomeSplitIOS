import Foundation
import Observation

/// Drives `HomeView`. Loads the open cycle + expenses + members + carryover,
/// then derives viewer-scoped stat-card counts the way RN's dashboard does.
@Observable
@MainActor
final class HomeViewModel {
    struct OwedExpenseItem: Identifiable, Hashable {
        let id: UUID
        let name: String
        let myShare: Decimal
        let mySplitId: UUID
        let payerName: String?
        let date: Date
    }

    private(set) var isLoading: Bool = false
    private(set) var lastError: String?

    private(set) var cycle: BillingCycle?
    private(set) var members: [Member] = []
    private(set) var expenses: [ExpenseWithDetails] = []
    private(set) var carryover: CarryoverDebt = .none
    private(set) var settlingSplitId: UUID?

    private let expensesRepository: any ExpensesRepositoryProtocol
    private let householdsRepository: any HouseholdRepositoryProtocol
    private let balancesRepository: any BalancesRepositoryProtocol

    init(
        expensesRepository: any ExpensesRepositoryProtocol,
        householdsRepository: any HouseholdRepositoryProtocol,
        balancesRepository: any BalancesRepositoryProtocol
    ) {
        self.expensesRepository = expensesRepository
        self.householdsRepository = householdsRepository
        self.balancesRepository = balancesRepository
    }

    func load(household: MembershipWithHousehold) async {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            async let cycleTask = expensesRepository.currentCycle(householdId: household.householdId)
            async let membersTask = householdsRepository.members(householdId: household.householdId)
            let (loadedCycle, loadedMembers) = try await (cycleTask, membersTask)
            cycle = loadedCycle
            members = loadedMembers
            guard let cycleId = loadedCycle?.id else {
                expenses = []
                carryover = .none
                return
            }
            async let expensesTask = expensesRepository.list(
                householdId: household.householdId,
                cycleId: cycleId
            )
            async let carryoverTask = balancesRepository.carryover(
                householdId: household.householdId,
                currentCycleId: cycleId,
                memberId: household.id
            )
            let (loadedExpenses, loadedCarryover) = try await (expensesTask, carryoverTask)
            expenses = loadedExpenses
            carryover = loadedCarryover
        } catch {
            lastError = error.localizedDescription
        }
    }

    func markMyShareAsPaid(splitId: UUID, household: MembershipWithHousehold) async {
        guard settlingSplitId == nil else { return }
        settlingSplitId = splitId
        defer { settlingSplitId = nil }
        do {
            try await expensesRepository.markSplitPaid(splitId: splitId)
            await load(household: household)
        } catch {
            lastError = error.localizedDescription
        }
    }

    // MARK: - Derived viewer-scoped values

    func viewerCounts(memberId: UUID) -> (iOwe: (count: Int, amount: Decimal), owedToMe: (count: Int, amount: Decimal)) {
        var iOweCount = 0
        var iOweAmount: Decimal = 0
        var owedToMeCount = 0
        var owedToMeAmount: Decimal = 0

        for expense in expenses {
            let paidByMe = expense.paidByMemberId == memberId
            let mine = expense.expenseSplits.first { $0.memberId == memberId }
            if !paidByMe, let mySplit = mine, mySplit.settledAt == nil {
                iOweCount += 1
                iOweAmount += mySplit.amountOwed
            }
            if paidByMe {
                let unsettledOthers = expense.expenseSplits.filter {
                    $0.memberId != memberId && $0.settledAt == nil
                }
                if !unsettledOthers.isEmpty {
                    owedToMeCount += 1
                    owedToMeAmount += unsettledOthers.reduce(Decimal(0)) { $0 + $1.amountOwed }
                }
            }
        }
        return ((iOweCount, iOweAmount), (owedToMeCount, owedToMeAmount))
    }

    func youOweCard(memberId: UUID) -> StatCardState {
        let counts = viewerCounts(memberId: memberId)
        return CardState.computeYouOwe(
            count: counts.iOwe.count,
            hasCarryover: carryover.iOweFromPrior
        )
    }

    func owedToYouCard(memberId: UUID) -> StatCardState {
        let counts = viewerCounts(memberId: memberId)
        return CardState.computeOwedToYou(
            count: counts.owedToMe.count,
            hasCarryover: carryover.owedToMeFromPrior
        )
    }

    /// Top N unpaid expenses where the viewer owes — newest first.
    func owedByMe(memberId: UUID, limit: Int = 5) -> [OwedExpenseItem] {
        expenses
            .filter { $0.paidByMemberId != memberId }
            .compactMap { expense -> OwedExpenseItem? in
                guard let mySplit = expense.expenseSplits.first(where: { $0.memberId == memberId }),
                      mySplit.settledAt == nil
                else { return nil }
                let payer = members.first { $0.id == expense.paidByMemberId }
                return OwedExpenseItem(
                    id: expense.id,
                    name: expense.description?.isEmpty == false
                        ? expense.description!
                        : expense.category.rawValue.capitalized,
                    myShare: mySplit.amountOwed,
                    mySplitId: mySplit.id,
                    payerName: payer?.displayName ?? expense.paidByMember?.displayName,
                    date: expense.date
                )
            }
            .sorted { $0.date > $1.date }
            .prefix(limit)
            .map { $0 }
    }
}
