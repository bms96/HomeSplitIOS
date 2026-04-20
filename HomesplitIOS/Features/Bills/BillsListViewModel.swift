import Foundation
import Observation

/// Drives `BillsView`. Loads recurring bills alongside the current open cycle
/// and its per-cycle overrides + payments, so the list can show "you paid"
/// badges and cycle-specific amounts.
@Observable
@MainActor
final class BillsListViewModel {
    private(set) var bills: [RecurringBill] = []
    private(set) var members: [Member] = []
    private(set) var cycle: BillingCycle?
    private(set) var cyclePayments: [BillCyclePayment] = []
    private(set) var cycleAmounts: [BillCycleAmount] = []
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?

    private let recurringBillsRepository: any RecurringBillsRepositoryProtocol
    private let expensesRepository: any ExpensesRepositoryProtocol
    private let householdsRepository: any HouseholdRepositoryProtocol

    init(
        recurringBillsRepository: any RecurringBillsRepositoryProtocol,
        expensesRepository: any ExpensesRepositoryProtocol,
        householdsRepository: any HouseholdRepositoryProtocol
    ) {
        self.recurringBillsRepository = recurringBillsRepository
        self.expensesRepository = expensesRepository
        self.householdsRepository = householdsRepository
    }

    var activeBillCount: Int { bills.filter(\.active).count }

    func load(householdId: UUID) async {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            async let billsTask = recurringBillsRepository.list(householdId: householdId)
            async let membersTask = householdsRepository.members(householdId: householdId)
            async let cycleTask = expensesRepository.currentCycle(householdId: householdId)
            let (loadedBills, loadedMembers, loadedCycle) =
                try await (billsTask, membersTask, cycleTask)
            bills = loadedBills
            members = loadedMembers.filter(\.isActive)
            cycle = loadedCycle
            if let cycleId = loadedCycle?.id {
                async let paymentsTask = recurringBillsRepository.cyclePayments(cycleId: cycleId)
                async let amountsTask = recurringBillsRepository.cycleAmounts(cycleId: cycleId)
                let (loadedPayments, loadedAmounts) = try await (paymentsTask, amountsTask)
                cyclePayments = loadedPayments
                cycleAmounts = loadedAmounts
            } else {
                cyclePayments = []
                cycleAmounts = []
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func paidCount(for billId: UUID) -> Int {
        cyclePayments.filter { $0.billId == billId }.count
    }

    func hasPaid(billId: UUID, memberId: UUID) -> Bool {
        cyclePayments.contains { $0.billId == billId && $0.memberId == memberId }
    }

    func cycleAmount(for billId: UUID) -> Decimal? {
        cycleAmounts.first { $0.billId == billId }?.amount
    }

    func includedMembers(for bill: RecurringBill) -> [Member] {
        let excluded = Set(bill.excludedMemberIds)
        return members.filter { !excluded.contains($0.id) }
    }
}
