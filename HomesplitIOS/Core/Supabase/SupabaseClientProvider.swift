import Foundation
import Supabase

/// Default `SupabaseClientProviding` implementation.
///
/// Reads URL + anon key from `Configuration` (populated by xcconfig), and
/// stores auth sessions in the iOS Keychain via `KeychainAuthStorage`.
/// One instance per app launch — share through `AppEnvironment`, never
/// construct `SupabaseClient` from view code.
///
/// Client construction is deferred to the first `client` access so the app
/// can still boot when xcconfig values are missing (e.g. iterating on UI
/// before Supabase credentials are wired). `Configuration`'s fatalError
/// guardrails fire the moment a repository actually issues a request.
final class SupabaseClientProvider: SupabaseClientProviding, @unchecked Sendable {
    static let shared = SupabaseClientProvider()

    private let factory: @Sendable () -> SupabaseClient
    private let lock = NSLock()
    private var cached: SupabaseClient?

    var client: SupabaseClient {
        lock.lock()
        defer { lock.unlock() }
        if let cached { return cached }
        let built = factory()
        cached = built
        return built
    }

    init(factory: @escaping @Sendable () -> SupabaseClient = SupabaseClientProvider.defaultFactory) {
        self.factory = factory
    }

    static let defaultFactory: @Sendable () -> SupabaseClient = {
        SupabaseClient(
            supabaseURL: Configuration.supabaseURL,
            supabaseKey: Configuration.supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: .init(
                    storage: KeychainAuthStorage(),
                    flowType: .pkce,
                    autoRefreshToken: true
                )
            )
        )
    }
}
