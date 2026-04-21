import Foundation
import Observation

/// Holds an invite-link token that arrived via deeplink but hasn't been
/// consumed yet (usually because the user wasn't signed in, or because the
/// app was launched cold from the tap). `RootView` watches this and
/// presents `JoinHouseholdView` as soon as auth + session are ready.
@Observable
@MainActor
final class PendingDeeplink {
    var joinToken: String?

    func setJoinToken(_ token: String) {
        joinToken = token
    }

    func clear() {
        joinToken = nil
    }
}
