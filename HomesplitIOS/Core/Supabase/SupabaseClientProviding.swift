import Foundation
import Supabase

/// Indirection over `SupabaseClient` so tests can substitute a fake.
///
/// Repositories depend on this protocol — never on `SupabaseClient` directly,
/// and never on a global. Inject through `AppEnvironment`.
protocol SupabaseClientProviding: Sendable {
    var client: SupabaseClient { get }
}
