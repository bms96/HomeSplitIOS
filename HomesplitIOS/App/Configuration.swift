import Foundation

enum Configuration {
    enum Key: String {
        case supabaseURL     = "SUPABASE_URL"
        case supabaseAnonKey = "SUPABASE_ANON_KEY"
        case revenueCatKey   = "RC_IOS_KEY"
        case posthogKey      = "POSTHOG_KEY"
        case sentryDSN       = "SENTRY_DSN"
        case appEnv          = "APP_ENV"
    }

    static var supabaseURL: URL {
        guard let url = URL(string: stringValue(.supabaseURL)) else {
            fatalError("SUPABASE_URL is not a valid URL. Check Config.*.xcconfig.")
        }
        return url
    }

    static var supabaseAnonKey: String { stringValue(.supabaseAnonKey) }
    static var revenueCatKey:   String { stringValue(.revenueCatKey) }
    static var posthogKey:      String { stringValue(.posthogKey) }
    static var sentryDSN:       String { stringValue(.sentryDSN) }
    static var appEnv:          String { stringValue(.appEnv) }
    static var isProd:          Bool   { appEnv == "production" }

    private static func stringValue(_ key: Key) -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key.rawValue) as? String,
              !value.isEmpty else {
            fatalError("Missing Info.plist value for \(key.rawValue). Fill in Config.*.xcconfig.")
        }
        return value
    }
}
