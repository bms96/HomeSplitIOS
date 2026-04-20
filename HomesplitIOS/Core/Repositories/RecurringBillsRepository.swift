import Foundation
import Supabase

/// Input for create-or-update of a recurring bill. `id == nil` means insert.
/// `amount == nil` means variable — `bill_cycle_amounts` becomes required
/// before any member can mark paid (server-side trigger `bcp_enforce_amount`).
struct SaveRecurringBillInput: Sendable {
    var id: UUID?
    let householdId: UUID
    let name: String
    let amount: Decimal?
    let frequency: BillFrequency
    let nextDueDate: Date
    let active: Bool
    let splitType: SplitType
    let excludedMemberIds: [UUID]
    let shares: [RecurringBill.Share]
}

struct SetBillCycleAmountInput: Sendable {
    let billId: UUID
    let cycleId: UUID
    let amount: Decimal
}

protocol RecurringBillsRepositoryProtocol: Sendable {
    func list(householdId: UUID) async throws -> [RecurringBill]
    func detail(id: UUID) async throws -> RecurringBill?
    func save(_ input: SaveRecurringBillInput) async throws -> RecurringBill
    func delete(id: UUID) async throws
    func cycleAmounts(cycleId: UUID) async throws -> [BillCycleAmount]
    func setCycleAmount(_ input: SetBillCycleAmountInput) async throws
    func cyclePayments(cycleId: UUID) async throws -> [BillCyclePayment]
    func togglePayment(billId: UUID, cycleId: UUID, memberId: UUID, existingId: UUID?) async throws
}

struct RecurringBillsRepository: RecurringBillsRepositoryProtocol {
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

    func list(householdId: UUID) async throws -> [RecurringBill] {
        let client = try requireClient()
        return try await client
            .from("recurring_bills")
            .select()
            .eq("household_id", value: householdId)
            .order("active", ascending: false)
            .order("next_due_date", ascending: true)
            .execute()
            .value
    }

    func detail(id: UUID) async throws -> RecurringBill? {
        let client = try requireClient()
        let rows: [RecurringBill] = try await client
            .from("recurring_bills")
            .select()
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func save(_ input: SaveRecurringBillInput) async throws -> RecurringBill {
        let client = try requireClient()
        let customSplits = Self.encodeCustomSplits(
            excludedMemberIds: input.excludedMemberIds,
            shares: input.shares
        )
        struct Payload: Encodable {
            let household_id: UUID
            let name: String
            let amount: Decimal?
            let frequency: BillFrequency
            let next_due_date: Date
            let active: Bool
            let split_type: SplitType
            let custom_splits: RecurringBill.CustomSplits?
        }
        let payload = Payload(
            household_id: input.householdId,
            name: input.name,
            amount: input.amount,
            frequency: input.frequency,
            next_due_date: input.nextDueDate,
            active: input.active,
            split_type: input.splitType,
            custom_splits: customSplits
        )
        if let id = input.id {
            return try await client
                .from("recurring_bills")
                .update(payload)
                .eq("id", value: id)
                .select()
                .single()
                .execute()
                .value
        }
        return try await client
            .from("recurring_bills")
            .insert(payload)
            .select()
            .single()
            .execute()
            .value
    }

    func delete(id: UUID) async throws {
        let client = try requireClient()
        try await client
            .from("recurring_bills")
            .delete()
            .eq("id", value: id)
            .execute()
    }

    func cycleAmounts(cycleId: UUID) async throws -> [BillCycleAmount] {
        let client = try requireClient()
        return try await client
            .from("bill_cycle_amounts")
            .select()
            .eq("cycle_id", value: cycleId)
            .execute()
            .value
    }

    func setCycleAmount(_ input: SetBillCycleAmountInput) async throws {
        let client = try requireClient()
        struct Upsert: Encodable {
            let bill_id: UUID
            let cycle_id: UUID
            let amount: Decimal
        }
        try await client
            .from("bill_cycle_amounts")
            .upsert(
                Upsert(bill_id: input.billId, cycle_id: input.cycleId, amount: input.amount),
                onConflict: "bill_id,cycle_id"
            )
            .execute()
    }

    func cyclePayments(cycleId: UUID) async throws -> [BillCyclePayment] {
        let client = try requireClient()
        return try await client
            .from("bill_cycle_payments")
            .select()
            .eq("cycle_id", value: cycleId)
            .execute()
            .value
    }

    func togglePayment(billId: UUID, cycleId: UUID, memberId: UUID, existingId: UUID?) async throws {
        let client = try requireClient()
        if let existingId {
            try await client
                .from("bill_cycle_payments")
                .delete()
                .eq("id", value: existingId)
                .execute()
            return
        }
        struct Insert: Encodable {
            let bill_id: UUID
            let cycle_id: UUID
            let member_id: UUID
        }
        try await client
            .from("bill_cycle_payments")
            .insert(Insert(bill_id: billId, cycle_id: cycleId, member_id: memberId))
            .execute()
    }

    private static func encodeCustomSplits(
        excludedMemberIds: [UUID],
        shares: [RecurringBill.Share]
    ) -> RecurringBill.CustomSplits? {
        guard !excludedMemberIds.isEmpty || !shares.isEmpty else { return nil }
        return RecurringBill.CustomSplits(
            excludedMemberIds: excludedMemberIds,
            shares: shares
        )
    }
}
