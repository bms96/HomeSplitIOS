import Foundation
import Observation

/// Drives `SettleView`. Loads the open cycle + members + balances, and exposes
/// two actions: record a settlement via `settle_pair` RPC, and derive the
/// simplified / pairwise debt rows the screen renders.
///
/// Pair-wise net debts are used for the viewer's own balances so "Mark paid"
/// always corresponds to real splits that `settle_pair` can clear. The roommate
/// -to-roommate rows use the fully simplified graph — fewer edges, read-only.
@Observable
@MainActor
final class SettleViewModel {
    private(set) var cycle: BillingCycle?
    private(set) var members: [Member] = []
    private(set) var balances: BalanceResult?
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?
    private(set) var settlingKey: String?

    private let currentMemberId: UUID
    private let householdId: UUID
    private let expensesRepository: any ExpensesRepositoryProtocol
    private let householdsRepository: any HouseholdRepositoryProtocol
    private let balancesRepository: any BalancesRepositoryProtocol

    init(
        household: MembershipWithHousehold,
        expensesRepository: any ExpensesRepositoryProtocol,
        householdsRepository: any HouseholdRepositoryProtocol,
        balancesRepository: any BalancesRepositoryProtocol
    ) {
        self.householdId = household.householdId
        self.currentMemberId = household.id
        self.expensesRepository = expensesRepository
        self.householdsRepository = householdsRepository
        self.balancesRepository = balancesRepository
    }

    /// Rows that touch the current viewer. Uses `pairwiseDebts` so "Mark paid"
    /// corresponds to actual splits the RPC can clear.
    var myDebts: [Debt] {
        (balances?.pairwiseDebts ?? []).filter {
            $0.from == currentMemberId.uuidString || $0.to == currentMemberId.uuidString
        }
    }

    /// Read-only rows between other roommates. Uses simplified graph for a
    /// cleaner picture with fewer edges.
    var otherDebts: [Debt] {
        (balances?.debts ?? []).filter {
            $0.from != currentMemberId.uuidString && $0.to != currentMemberId.uuidString
        }
    }

    var hasAnyDebts: Bool { !(balances?.debts.isEmpty ?? true) }

    func member(id: String) -> Member? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        return members.first { $0.id == uuid }
    }

    func isViewer(memberId: String) -> Bool {
        memberId == currentMemberId.uuidString
    }

    func settleKey(for debt: Debt) -> String {
        "\(debt.from):\(debt.to)"
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
            members = loadedMembers.filter(\.isActive)
            if let cycleId = loadedCycle?.id {
                balances = try await balancesRepository.balances(
                    householdId: householdId,
                    cycleId: cycleId
                )
            } else {
                balances = BalanceResult(debts: [], pairwiseDebts: [], netByMember: [])
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Record that the viewer paid `debt.to` `debt.amount` via the supplied
    /// method. Mirrors RN's default of `.other` when called from "Mark paid".
    func markPaid(_ debt: Debt, method: SettlementMethod = .other) async {
        guard let fromId = UUID(uuidString: debt.from),
              let toId = UUID(uuidString: debt.to)
        else { return }
        let key = settleKey(for: debt)
        guard settlingKey == nil else { return }
        settlingKey = key
        defer { settlingKey = nil }
        do {
            _ = try await balancesRepository.settlePair(
                householdId: householdId,
                fromMemberId: fromId,
                toMemberId: toId,
                amount: debt.amount,
                method: method,
                notes: nil
            )
            await load()
        } catch {
            lastError = error.localizedDescription
        }
    }
}
