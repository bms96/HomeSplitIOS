import Foundation
import Supabase

/// Expense row joined with the paying member — the shape the list and detail
/// screens read. Mirrors the RN `ExpenseWithDetails` alias.
struct ExpenseWithDetails: Codable, Hashable, Identifiable, Sendable {
    let id: UUID
    let householdId: UUID
    var cycleId: UUID?
    var paidByMemberId: UUID
    var amount: Decimal
    var description: String?
    var category: ExpenseCategory
    var date: Date
    var dueDate: Date?
    var recurringBillId: UUID?
    var paidByMember: PaidByMember?
    var expenseSplits: [ExpenseSplit]

    struct PaidByMember: Codable, Hashable, Sendable {
        let id: UUID
        let displayName: String
        let color: String

        enum CodingKeys: String, CodingKey {
            case id
            case displayName = "display_name"
            case color
        }
    }

    var expense: Expense {
        Expense(
            id: id,
            householdId: householdId,
            cycleId: cycleId,
            paidByMemberId: paidByMemberId,
            amount: amount,
            description: description,
            category: category,
            date: date,
            dueDate: dueDate,
            recurringBillId: recurringBillId
        )
    }

    enum CodingKeys: String, CodingKey {
        case id
        case householdId      = "household_id"
        case cycleId          = "cycle_id"
        case paidByMemberId   = "paid_by_member_id"
        case amount
        case description
        case category
        case date
        case dueDate          = "due_date"
        case recurringBillId  = "recurring_bill_id"
        case paidByMember     = "paid_by_member"
        case expenseSplits    = "expense_splits"
    }
}

/// Input for creating an expense. Member IDs drive the equal-split calculation;
/// the payer is typically included so "owes themselves" rows exist for detail
/// display — balance math filters those out.
struct AddExpenseInput: Sendable {
    let householdId: UUID
    let cycleId: UUID
    let paidByMemberId: UUID
    let amount: Decimal
    let description: String
    let category: ExpenseCategory
    var date: Date?
    var dueDate: Date?
    let memberIds: [UUID]
}

struct UpdateExpenseInput: Sendable {
    let id: UUID
    let paidByMemberId: UUID
    let amount: Decimal
    let description: String
    let category: ExpenseCategory
    let date: Date
    var dueDate: Date?
    let memberIds: [UUID]
}

protocol ExpensesRepositoryProtocol: Sendable {
    func currentCycle(householdId: UUID) async throws -> BillingCycle?
    func list(householdId: UUID, cycleId: UUID) async throws -> [ExpenseWithDetails]
    func detail(id: UUID) async throws -> ExpenseWithDetails?
    func create(_ input: AddExpenseInput) async throws -> Expense
    func update(_ input: UpdateExpenseInput) async throws -> Expense
    func delete(id: UUID) async throws
    func markSplitPaid(splitId: UUID) async throws
}

struct ExpensesRepository: ExpensesRepositoryProtocol {
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

    func currentCycle(householdId: UUID) async throws -> BillingCycle? {
        let client = try requireClient()
        let rows: [BillingCycle] = try await client
            .from("billing_cycles")
            .select()
            .eq("household_id", value: householdId)
            .is("closed_at", value: nil)
            .order("start_date", ascending: false)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func list(householdId: UUID, cycleId: UUID) async throws -> [ExpenseWithDetails] {
        let client = try requireClient()
        return try await client
            .from("expenses")
            .select("""
            *,
            paid_by_member:members!expenses_paid_by_member_id_fkey(id, display_name, color),
            expense_splits(*)
            """)
            .eq("household_id", value: householdId)
            .eq("cycle_id", value: cycleId)
            .order("date", ascending: false)
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    func detail(id: UUID) async throws -> ExpenseWithDetails? {
        let client = try requireClient()
        let rows: [ExpenseWithDetails] = try await client
            .from("expenses")
            .select("""
            *,
            paid_by_member:members!expenses_paid_by_member_id_fkey(id, display_name, color),
            expense_splits(*)
            """)
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func create(_ input: AddExpenseInput) async throws -> Expense {
        let client = try requireClient()
        struct ExpenseInsert: Encodable {
            let household_id: UUID
            let cycle_id: UUID
            let paid_by_member_id: UUID
            let amount: Decimal
            let description: String
            let category: ExpenseCategory
            let date: Date?
            let due_date: Date?
        }
        let inserted: Expense = try await client
            .from("expenses")
            .insert(ExpenseInsert(
                household_id: input.householdId,
                cycle_id: input.cycleId,
                paid_by_member_id: input.paidByMemberId,
                amount: input.amount,
                description: input.description,
                category: input.category,
                date: input.date,
                due_date: input.dueDate
            ))
            .select()
            .single()
            .execute()
            .value

        try await insertSplits(expenseId: inserted.id, amount: input.amount, memberIds: input.memberIds, on: client)
        return inserted
    }

    func update(_ input: UpdateExpenseInput) async throws -> Expense {
        let client = try requireClient()
        struct ExpenseUpdate: Encodable {
            let paid_by_member_id: UUID
            let amount: Decimal
            let description: String
            let category: ExpenseCategory
            let date: Date
            let due_date: Date?
        }
        let updated: Expense = try await client
            .from("expenses")
            .update(ExpenseUpdate(
                paid_by_member_id: input.paidByMemberId,
                amount: input.amount,
                description: input.description,
                category: input.category,
                date: input.date,
                due_date: input.dueDate
            ))
            .eq("id", value: input.id)
            .select()
            .single()
            .execute()
            .value

        try await client
            .from("expense_splits")
            .delete()
            .eq("expense_id", value: input.id)
            .is("settled_at", value: nil)
            .execute()

        try await insertSplits(expenseId: input.id, amount: input.amount, memberIds: input.memberIds, on: client)
        return updated
    }

    func delete(id: UUID) async throws {
        let client = try requireClient()
        try await client
            .from("expenses")
            .delete()
            .eq("id", value: id)
            .execute()
    }

    func markSplitPaid(splitId: UUID) async throws {
        let client = try requireClient()
        struct SplitUpdate: Encodable { let settled_at: Date }
        try await client
            .from("expense_splits")
            .update(SplitUpdate(settled_at: Date()))
            .eq("id", value: splitId)
            .execute()
    }

    private func insertSplits(
        expenseId: UUID,
        amount: Decimal,
        memberIds: [UUID],
        on client: SupabaseClient
    ) async throws {
        guard !memberIds.isEmpty else { return }
        let splits = Splits.calculateEqual(
            amount: amount,
            memberIds: memberIds.map(\.uuidString)
        )
        struct SplitInsert: Encodable {
            let expense_id: UUID
            let member_id: UUID
            let amount_owed: Decimal
        }
        let rows = splits.compactMap { split -> SplitInsert? in
            guard let memberId = UUID(uuidString: split.memberId) else { return nil }
            return SplitInsert(
                expense_id: expenseId,
                member_id: memberId,
                amount_owed: split.amountOwed
            )
        }
        try await client
            .from("expense_splits")
            .insert(rows)
            .execute()
    }
}
