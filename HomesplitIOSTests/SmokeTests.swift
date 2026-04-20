import Foundation
import Testing
@testable import Homesplit

struct SmokeTests {
    @Test("bundle loads and Configuration keys are declared")
    func configurationKeysDeclared() {
        for key in [
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "RC_IOS_KEY",
            "POSTHOG_KEY",
            "APP_ENV"
        ] {
            #expect(Bundle.main.object(forInfoDictionaryKey: key) != nil,
                    "Info.plist is missing key \(key) — check Config.*.xcconfig")
        }
    }
}
