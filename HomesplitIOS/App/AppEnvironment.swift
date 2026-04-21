import SwiftUI

/// Top-level dependency container.
///
/// Built once at app launch and injected through `@Environment(\.app)`.
/// Tests construct a fake provider and pass it directly to the view-models
/// they exercise — they never read this environment value.
@MainActor
struct AppEnvironment {
    let supabase: any SupabaseClientProviding
    let auth: AuthSession
    let households: any HouseholdRepositoryProtocol
    let expenses: any ExpensesRepositoryProtocol
    let balances: any BalancesRepositoryProtocol
    let recurringBills: any RecurringBillsRepositoryProtocol
    let categoryPreferences: any CategoryPreferencesRepositoryProtocol
    let moveOuts: any MoveOutRepositoryProtocol
    let subscriptions: any SubscriptionsRepositoryProtocol
    let householdSession: HouseholdSession
    let paywallGate: PaywallGateService
    let pendingDeeplink: PendingDeeplink
    let badges: BadgeStore

    static func live() -> AppEnvironment {
        let supabase = SupabaseClientProvider.shared
        let households = HouseholdRepository(provider: supabase)
        let expenses = ExpensesRepository(provider: supabase)
        let balances = BalancesRepository(provider: supabase)
        let recurringBills = RecurringBillsRepository(provider: supabase)
        let categoryPreferences = CategoryPreferencesRepository(provider: supabase)
        let moveOuts = MoveOutRepository(provider: supabase)
        let subscriptions = SubscriptionsRepository(provider: supabase)
        let revenueCat: any RevenueCatClient = StubRevenueCatClient()
        return AppEnvironment(
            supabase: supabase,
            auth: AuthSession(provider: supabase),
            households: households,
            expenses: expenses,
            balances: balances,
            recurringBills: recurringBills,
            categoryPreferences: categoryPreferences,
            moveOuts: moveOuts,
            subscriptions: subscriptions,
            householdSession: HouseholdSession(repository: households),
            paywallGate: PaywallGateService(
                subscriptionsRepo: subscriptions,
                revenueCat: revenueCat
            ),
            pendingDeeplink: PendingDeeplink(),
            badges: BadgeStore(
                expensesRepository: expenses,
                recurringBillsRepository: recurringBills
            )
        )
    }
}

private struct AppEnvironmentKey: EnvironmentKey {
    // SwiftUI environment access happens on the main actor in practice;
    // assume isolation so `EnvironmentKey`'s nonisolated requirement is met
    // without relaxing `AppEnvironment`'s own isolation.
    static var defaultValue: AppEnvironment {
        MainActor.assumeIsolated { .live() }
    }
}

extension EnvironmentValues {
    var app: AppEnvironment {
        get { self[AppEnvironmentKey.self] }
        set { self[AppEnvironmentKey.self] = newValue }
    }
}
