import Foundation
import Supabase

/// Aggregated balance result for the current open cycle.
/// Mirrors RN `useBalances.BalanceResult`: `debts` is the fully-simplified
/// graph for overview counts; `pairwiseDebts` is per-pair netted for settle
/// actions; `netByMember` is the per-member rollup.
struct BalanceResult: Sendable, Hashable {
    let debts: [Debt]
    let pairwiseDebts: [Debt]
    let netByMember: [MemberNetBalance]
}

/// Viewer-scoped carryover booleans. `true` means the viewer has unsettled
/// debt (in or out) from a cycle OTHER than the currently open one.
struct CarryoverDebt: Sendable, Hashable {
    let iOweFromPrior: Bool
    let owedToMeFromPrior: Bool

    static let none = CarryoverDebt(iOweFromPrior: false, owedToMeFromPrior: false)
}

protocol BalancesRepositoryProtocol: Sendable {
    func balances(householdId: UUID, cycleId: UUID) async throws -> BalanceResult
    func carryover(householdId: UUID, currentCycleId: UUID, memberId: UUID) async throws -> CarryoverDebt
    func settlePair(
        householdId: UUID,
        fromMemberId: UUID,
        toMemberId: UUID,
        amount: Decimal,
        method: SettlementMethod,
        notes: String?
    ) async throws -> UUID
}

struct BalancesRepository: BalancesRepositoryProtocol {
    private let provider: any SupabaseClientProviding

    init(provider: any SupabaseClientProviding) {
        self.provider = provider
    }

    private func requireClient() throws -> SupabaseClient {
        guard Configuration.isSupabaseConfigured else {
            throw ConfigurationError.supabaseNotConfigured
        }
        return provider.client
    }

    private struct UnsettledSplitRow: Decodable {
        let memberId: UUID
        let amountOwed: Decimal
        let expense: ExpenseJoin?

        struct ExpenseJoin: Decodable {
            let paidByMemberId: UUID
            let cycleId: UUID?

            enum CodingKeys: String, CodingKey {
                case paidByMemberId = "paid_by_member_id"
                case cycleId        = "cycle_id"
            }
        }

        enum CodingKeys: String, CodingKey {
            case memberId   = "member_id"
            case amountOwed = "amount_owed"
            case expense
        }
    }

    func balances(householdId: UUID, cycleId: UUID) async throws -> BalanceResult {
        let client = try requireClient()
        let rows: [UnsettledSplitRow] = try await client
            .from("expense_splits")
            .select("""
            member_id,
            amount_owed,
            expense:expenses!inner(paid_by_member_id, household_id, cycle_id)
            """)
            .is("settled_at", value: nil)
            .eq("expense.household_id", value: householdId)
            .eq("expense.cycle_id", value: cycleId)
            .execute()
            .value

        let splits: [SplitRow] = rows.compactMap { row in
            guard let expense = row.expense else { return nil }
            return SplitRow(
                memberId: row.memberId.uuidString,
                amountOwed: row.amountOwed,
                paidByMemberId: expense.paidByMemberId.uuidString
            )
        }

        let rawDebts: [Debt] = splits
            .filter { $0.memberId != $0.paidByMemberId }
            .map { Debt(from: $0.memberId, to: $0.paidByMemberId, amount: $0.amountOwed) }

        return BalanceResult(
            debts: Debts.simplify(rawDebts),
            pairwiseDebts: Debts.computePairwise(rawDebts),
            netByMember: Debts.computeNetBalances(splits)
        )
    }

    func carryover(householdId: UUID, currentCycleId: UUID, memberId: UUID) async throws -> CarryoverDebt {
        let client = try requireClient()
        let rows: [UnsettledSplitRow] = try await client
            .from("expense_splits")
            .select("""
            member_id,
            amount_owed,
            expense:expenses!inner(paid_by_member_id, household_id, cycle_id)
            """)
            .is("settled_at", value: nil)
            .eq("expense.household_id", value: householdId)
            .neq("expense.cycle_id", value: currentCycleId)
            .execute()
            .value

        var iOwe = false
        var owedToMe = false
        for row in rows {
            guard let expense = row.expense else { continue }
            if row.memberId == expense.paidByMemberId { continue }
            if row.memberId == memberId { iOwe = true }
            if expense.paidByMemberId == memberId { owedToMe = true }
            if iOwe && owedToMe { break }
        }
        return CarryoverDebt(iOweFromPrior: iOwe, owedToMeFromPrior: owedToMe)
    }

    func settlePair(
        householdId: UUID,
        fromMemberId: UUID,
        toMemberId: UUID,
        amount: Decimal,
        method: SettlementMethod,
        notes: String?
    ) async throws -> UUID {
        let client = try requireClient()
        struct Params: Encodable {
            let p_household_id: UUID
            let p_from_member_id: UUID
            let p_to_member_id: UUID
            let p_amount: Decimal
            let p_method: SettlementMethod
            let p_notes: String?
        }
        return try await client
            .rpc("settle_pair", params: Params(
                p_household_id: householdId,
                p_from_member_id: fromMemberId,
                p_to_member_id: toMemberId,
                p_amount: amount,
                p_method: method,
                p_notes: notes
            ))
            .execute()
            .value
    }
}
