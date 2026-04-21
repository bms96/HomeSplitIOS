import Foundation
import Supabase

protocol SubscriptionsRepositoryProtocol: Sendable {
    func current(householdId: UUID) async throws -> Subscription?
}

struct SubscriptionsRepository: SubscriptionsRepositoryProtocol {
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

    func current(householdId: UUID) async throws -> Subscription? {
        let client = try requireClient()
        let rows: [Subscription] = try await client
            .from("subscriptions")
            .select()
            .eq("household_id", value: householdId)
            .limit(1)
            .execute()
            .value
        return rows.first
    }
}
