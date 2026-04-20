import Foundation
import Observation

/// Drives `BillDetailView`. Loads the bill plus current-cycle state (payments,
/// amount override) and exposes the two actions the screen needs: toggle the
/// current member's payment row, and set this cycle's amount for a variable bill.
@Observable
@MainActor
final class BillDetailViewModel {
    private(set) var bill: RecurringBill?
    private(set) var members: [Member] = []
    private(set) var cycle: BillingCycle?
    private(set) var cyclePayments: [BillCyclePayment] = []
    private(set) var cycleAmounts: [BillCycleAmount] = []
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?
    private(set) var togglingMemberId: UUID?
    private(set) var isSavingAmount: Bool = false

    private let billId: UUID
    private let currentMemberId: UUID
    private let recurringBillsRepository: any RecurringBillsRepositoryProtocol
    private let expensesRepository: any ExpensesRepositoryProtocol
    private let householdsRepository: any HouseholdRepositoryProtocol

    init(
        billId: UUID,
        household: MembershipWithHousehold,
        recurringBillsRepository: any RecurringBillsRepositoryProtocol,
        expensesRepository: any ExpensesRepositoryProtocol,
        householdsRepository: any HouseholdRepositoryProtocol
    ) {
        self.billId = billId
        self.currentMemberId = household.id
        self.recurringBillsRepository = recurringBillsRepository
        self.expensesRepository = expensesRepository
        self.householdsRepository = householdsRepository
    }

    var includedMembers: [Member] {
        guard let bill else { return [] }
        let excluded = Set(bill.excludedMemberIds)
        return members.filter { !excluded.contains($0.id) }
    }

    var paidCount: Int {
        cyclePayments.filter { $0.billId == billId }.count
    }

    var cycleAmountOverride: Decimal? {
        cycleAmounts.first { $0.billId == billId }?.amount
    }

    var effectiveAmount: Decimal? {
        cycleAmountOverride ?? bill?.amount
    }

    var isVariableAmount: Bool { bill?.amount == nil }
    var needsCycleAmount: Bool { effectiveAmount == nil }

    /// Someone already marked this cycle paid — editing the bill's structure is
    /// locked until the next cycle so splits don't change under people.
    var isLockedForEdits: Bool {
        let activeIds = Set(members.map(\.id))
        return cyclePayments.contains { $0.billId == billId && activeIds.contains($0.memberId) }
    }

    func hasPaid(memberId: UUID) -> Bool {
        cyclePayments.contains { $0.billId == billId && $0.memberId == memberId }
    }

    func paymentId(for memberId: UUID) -> UUID? {
        cyclePayments.first { $0.billId == billId && $0.memberId == memberId }?.id
    }

    func load(householdId: UUID) async {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        do {
            async let billTask = recurringBillsRepository.detail(id: billId)
            async let membersTask = householdsRepository.members(householdId: householdId)
            async let cycleTask = expensesRepository.currentCycle(householdId: householdId)
            let (loadedBill, loadedMembers, loadedCycle) =
                try await (billTask, membersTask, cycleTask)
            bill = loadedBill
            members = loadedMembers.filter(\.isActive)
            cycle = loadedCycle
            if let cycleId = loadedCycle?.id {
                async let payments = recurringBillsRepository.cyclePayments(cycleId: cycleId)
                async let amounts = recurringBillsRepository.cycleAmounts(cycleId: cycleId)
                let (p, a) = try await (payments, amounts)
                cyclePayments = p
                cycleAmounts = a
            } else {
                cyclePayments = []
                cycleAmounts = []
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Toggle payment for the current member only. Returns true when the cycle
    /// was completed by this toggle so the caller can navigate home — mirrors
    /// the server-side trigger that advances the bill and clears payments.
    @discardableResult
    func toggleMyPayment() async -> Bool {
        guard let cycle, let bill else { return false }
        if needsCycleAmount && !hasPaid(memberId: currentMemberId) { return false }
        togglingMemberId = currentMemberId
        defer { togglingMemberId = nil }
        let existingId = paymentId(for: currentMemberId)
        let alreadyPaid = existingId != nil
        let willComplete = !alreadyPaid
            && !includedMembers.isEmpty
            && paidCount + 1 >= includedMembers.count
        do {
            try await recurringBillsRepository.togglePayment(
                billId: bill.id,
                cycleId: cycle.id,
                memberId: currentMemberId,
                existingId: existingId
            )
            await load(householdId: bill.householdId)
            return willComplete
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func setCycleAmount(_ amount: Decimal) async -> Bool {
        guard let cycle, let bill else { return false }
        guard amount > 0 else { return false }
        isSavingAmount = true
        defer { isSavingAmount = false }
        do {
            try await recurringBillsRepository.setCycleAmount(
                SetBillCycleAmountInput(billId: bill.id, cycleId: cycle.id, amount: amount)
            )
            await load(householdId: bill.householdId)
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    /// Per-included-member share for the current cycle. Equal-split only at MVP.
    func shareAmount(for memberId: UUID) -> Decimal? {
        guard let amount = effectiveAmount, !includedMembers.isEmpty else { return nil }
        let splits = Splits.calculateEqual(
            amount: amount,
            memberIds: includedMembers.map(\.id.uuidString)
        )
        return splits.first { $0.memberId == memberId.uuidString }?.amountOwed
    }
}
