import Foundation

/// Thrown when a repository or auth call is attempted before
/// `Config.*.xcconfig` has been populated with real Supabase credentials.
/// Surfaced to the UI as a readable alert so previews and dev iteration
/// don't hard-crash on a missing-key `fatalError`.
enum ConfigurationError: LocalizedError {
    case supabaseNotConfigured

    var errorDescription: String? {
        switch self {
        case .supabaseNotConfigured:
            return "Supabase isn't configured yet. Fill in SUPABASE_URL and SUPABASE_ANON_KEY in Config.Debug-Dev.xcconfig, then rebuild."
        }
    }
}
