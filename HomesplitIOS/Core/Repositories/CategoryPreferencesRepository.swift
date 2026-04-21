import Foundation
import Supabase

protocol CategoryPreferencesRepositoryProtocol: Sendable {
    func list(householdId: UUID) async throws -> [ExpenseCategoryPreference]
    func upsert(
        householdId: UUID,
        category: ExpenseCategory,
        hidden: Bool,
        customLabel: String?
    ) async throws
}

struct CategoryPreferencesRepository: CategoryPreferencesRepositoryProtocol {
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

    func list(householdId: UUID) async throws -> [ExpenseCategoryPreference] {
        let client = try requireClient()
        return try await client
            .from("expense_category_preferences")
            .select()
            .eq("household_id", value: householdId)
            .execute()
            .value
    }

    func upsert(
        householdId: UUID,
        category: ExpenseCategory,
        hidden: Bool,
        customLabel: String?
    ) async throws {
        let client = try requireClient()
        struct Upsert: Encodable {
            let household_id: UUID
            let category: ExpenseCategory
            let hidden: Bool
            let custom_label: String?
            let updated_at: Date
        }
        try await client
            .from("expense_category_preferences")
            .upsert(
                Upsert(
                    household_id: householdId,
                    category: category,
                    hidden: hidden,
                    custom_label: customLabel,
                    updated_at: Date()
                ),
                onConflict: "household_id,category"
            )
            .execute()
    }
}
