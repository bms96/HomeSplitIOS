import Foundation
import Observation

/// Drives the tab-bar badges on Home (unsettled "you owe" count) and Bills
/// (overdue active bills the viewer hasn't paid). Computed centrally so
/// badges stay accurate even when the user is on a different tab.
@Observable
@MainActor
final class BadgeStore {
    private(set) var youOweCount: Int = 0
    private(set) var overdueBillCount: Int = 0
    private(set) var isRefreshing: Bool = false

    private let expensesRepository: any ExpensesRepositoryProtocol
    private let recurringBillsRepository: any RecurringBillsRepositoryProtocol

    init(
        expensesRepository: any ExpensesRepositoryProtocol,
        recurringBillsRepository: any RecurringBillsRepositoryProtocol
    ) {
        self.expensesRepository = expensesRepository
        self.recurringBillsRepository = recurringBillsRepository
    }

    func refresh(household: MembershipWithHousehold) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            async let cycleTask = expensesRepository.currentCycle(householdId: household.householdId)
            async let billsTask = recurringBillsRepository.list(householdId: household.householdId)
            let (cycle, bills) = try await (cycleTask, billsTask)

            if let cycle {
                let expenses = try await expensesRepository.list(
                    householdId: household.householdId,
                    cycleId: cycle.id
                )
                youOweCount = expenses.reduce(0) { total, expense in
                    guard expense.paidByMemberId != household.id else { return total }
                    let mySplit = expense.expenseSplits.first { $0.memberId == household.id }
                    return (mySplit?.settledAt == nil && mySplit != nil) ? total + 1 : total
                }

                let payments = try await recurringBillsRepository.cyclePayments(cycleId: cycle.id)
                overdueBillCount = bills.reduce(0) { total, bill in
                    guard bill.active else { return total }
                    guard !bill.excludedMemberIds.contains(household.id) else { return total }
                    guard daysUntil(date: bill.nextDueDate) < 0 else { return total }
                    let iPaid = payments.contains { $0.billId == bill.id && $0.memberId == household.id }
                    return iPaid ? total : total + 1
                }
            } else {
                youOweCount = 0
                overdueBillCount = 0
            }
        } catch {
            // Badges are best-effort — leave prior values intact on failure.
        }
    }

    func clear() {
        youOweCount = 0
        overdueBillCount = 0
    }

    private func daysUntil(date: Date) -> Int {
        let calendar = Calendar.current
        let startToday = calendar.startOfDay(for: Date())
        let startTarget = calendar.startOfDay(for: date)
        return calendar.dateComponents([.day], from: startToday, to: startTarget).day ?? 0
    }
}
