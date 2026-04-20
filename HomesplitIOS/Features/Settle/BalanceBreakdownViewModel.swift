import Foundation
import Observation

/// Drives `BalanceBreakdownView`. Loads the current cycle's expenses and
/// projects unsettled splits between the viewer and one other member into
/// "you owe" / "they owe" lists. Mirrors RN's `balances/[memberId].tsx`.
@Observable
@MainActor
final class BalanceBreakdownViewModel {
    struct Row: Identifiable, Hashable {
        let id: String            // "<expenseId>:<splitId>"
        let expenseId: UUID
        let description: String
        let date: Date
        let amount: Decimal
    }

    private(set) var cycle: BillingCycle?
    private(set) var members: [Member] = []
    private(set) var expenses: [ExpenseWithDetails] = []
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?

    let otherMemberId: UUID
    private let currentMemberId: UUID
    private let householdId: UUID
    private let expensesRepository: any ExpensesRepositoryProtocol
    private let householdsRepository: any HouseholdRepositoryProtocol

    init(
        otherMemberId: UUID,
        household: MembershipWithHousehold,
        expensesRepository: any ExpensesRepositoryProtocol,
        householdsRepository: any HouseholdRepositoryProtocol
    ) {
        self.otherMemberId = otherMemberId
        self.currentMemberId = household.id
        self.householdId = household.householdId
        self.expensesRepository = expensesRepository
        self.householdsRepository = householdsRepository
    }

    var otherMember: Member? {
        members.first { $0.id == otherMemberId }
    }

    var otherDisplayName: String {
        otherMember?.displayName ?? "Former member"
    }

    /// Splits where the viewer owes the other member (other member paid, viewer's split unsettled).
    var youOweRows: [Row] {
        rows(payerId: otherMemberId, debtorId: currentMemberId)
    }

    /// Splits where the other member owes the viewer (viewer paid, other's split unsettled).
    var theyOweRows: [Row] {
        rows(payerId: currentMemberId, debtorId: otherMemberId)
    }

    var youOweTotal: Decimal {
        youOweRows.reduce(Decimal(0)) { $0 + $1.amount }
    }

    var theyOweTotal: Decimal {
        theyOweRows.reduce(Decimal(0)) { $0 + $1.amount }
    }

    var net: Decimal { youOweTotal - theyOweTotal }

    var netLabel: String {
        let threshold = Decimal(string: "0.005") ?? 0
        if net > threshold {
            return "You owe \(otherDisplayName) \(net.formatted(.currency(code: "USD")))"
        }
        if net < -threshold {
            let absolute = (-net).formatted(.currency(code: "USD"))
            return "\(otherDisplayName) owes you \(absolute)"
        }
        return "Settled with this roommate"
    }

    var isSettled: Bool {
        let threshold = Decimal(string: "0.005") ?? 0
        return net <= threshold && net >= -threshold
    }

    func load() async {
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

    private func rows(payerId: UUID, debtorId: UUID) -> [Row] {
        var result: [Row] = []
        for expense in expenses where expense.paidByMemberId == payerId {
            for split in expense.expenseSplits {
                guard split.settledAt == nil else { continue }
                guard split.memberId != expense.paidByMemberId else { continue }
                guard split.memberId == debtorId else { continue }
                result.append(Row(
                    id: "\(expense.id):\(split.id)",
                    expenseId: expense.id,
                    description: (expense.description?.isEmpty == false)
                        ? expense.description!
                        : expense.category.rawValue.capitalized,
                    date: expense.date,
                    amount: split.amountOwed
                ))
            }
        }
        return result.sorted { $0.date > $1.date }
    }
}
