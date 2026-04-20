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
                db: .init(decoder: postgrestDecoder),
                auth: .init(
                    storage: KeychainAuthStorage(),
                    flowType: .pkce,
                    autoRefreshToken: true,
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }
}

/// PostgREST decoder that understands date-only strings (Postgres `DATE`
/// columns like `expenses.date` serialize to "2026-04-20") in addition to
/// the full ISO8601 timestamps supabase-swift handles out of the box.
private let postgrestDecoder: JSONDecoder = {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .custom { decoder in
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)

        if let date = try? Date(string, strategy: .iso8601.currentTimestamp(includingFractionalSeconds: true)) {
            return date
        }
        if let date = try? Date(string, strategy: .iso8601.currentTimestamp(includingFractionalSeconds: false)) {
            return date
        }
        if let date = PostgrestDateFormatters.dateOnly.date(from: string) {
            return date
        }
        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Unrecognized date format: \(string)"
        )
    }
    return decoder
}()

private enum PostgrestDateFormatters {
    static let dateOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()
}

private extension Date.ISO8601FormatStyle {
    func currentTimestamp(includingFractionalSeconds: Bool) -> Self {
        year().month().day()
            .dateTimeSeparator(.standard)
            .time(includingFractionalSeconds: includingFractionalSeconds)
    }
}
