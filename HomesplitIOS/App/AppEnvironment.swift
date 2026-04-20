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
    let householdSession: HouseholdSession

    static func live() -> AppEnvironment {
        let supabase = SupabaseClientProvider.shared
        let households = HouseholdRepository(provider: supabase)
        return AppEnvironment(
            supabase: supabase,
            auth: AuthSession(provider: supabase),
            households: households,
            householdSession: HouseholdSession(repository: households)
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
