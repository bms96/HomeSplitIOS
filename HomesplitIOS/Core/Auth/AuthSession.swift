import Foundation
import Observation
import Supabase

/// Observable wrapper around `supabase.auth`. The single source of truth
/// for whether the user is signed in.
///
/// Mirrors the RN `authStore`: bootstraps once at launch, listens for
/// state changes, and exposes the magic-link sign-in / sign-out actions
/// the UI binds to.
@Observable
@MainActor
final class AuthSession {
    private(set) var session: Session?
    private(set) var user: User?
    private(set) var isInitialized: Bool = false
    private(set) var lastError: String?

    private let provider: any SupabaseClientProviding
    private var listenerTask: Task<Void, Never>?

    static let magicLinkRedirect = URL(string: "homesplit://auth-callback")!

    init(provider: any SupabaseClientProviding) {
        self.provider = provider
    }

    // No deinit: AuthSession is held in AppEnvironment for the app's
    // lifetime. Adding one would tangle main-actor isolation with the
    // nonisolated deinit context under Swift 6 strict concurrency.

    /// Read the persisted session and start listening for auth changes.
    /// Safe to call multiple times — work runs only once.
    func initialize() async {
        guard !isInitialized else { return }
        guard Configuration.isSupabaseConfigured else {
            // Allows test-host boot (and dev iteration without credentials)
            // to proceed — any repository call will still fail loudly.
            isInitialized = true
            return
        }
        let auth = provider.client.auth
        let current = auth.currentSession
        session = current
        user = current?.user
        isInitialized = true

        listenerTask?.cancel()
        listenerTask = Task { [weak self] in
            guard let self else { return }
            for await change in auth.authStateChanges {
                await MainActor.run {
                    self.session = change.session
                    self.user = change.session?.user
                }
            }
        }
    }

    /// Send a magic link to the user's email.
    func signInWithEmail(_ email: String) async throws {
        lastError = nil
        try await provider.client.auth.signInWithOTP(
            email: email,
            redirectTo: Self.magicLinkRedirect
        )
    }

    /// Complete the magic-link round-trip after the URL deep-links back in.
    func handleAuthCallback(url: URL) async {
        do {
            let session = try await provider.client.auth.session(from: url)
            self.session = session
            self.user = session.user
        } catch {
            lastError = "Could not finish signing in. \(error.localizedDescription)"
        }
    }

    func signOut() async {
        do {
            try await provider.client.auth.signOut()
            session = nil
            user = nil
        } catch {
            lastError = "Sign-out failed. \(error.localizedDescription)"
        }
    }

    var isSignedIn: Bool { session != nil }
}
