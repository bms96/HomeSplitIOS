import SwiftUI

@main
struct HomesplitApp: App {
    @State private var appEnvironment = AppEnvironment.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(\.app, appEnvironment)
                .onOpenURL { url in
                    handle(url: url)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL { handle(url: url) }
                }
                .devBadgeOverlay()
        }
    }

    private func handle(url: URL) {
        if url.host == "auth-callback" {
            Task { await appEnvironment.auth.handleAuthCallback(url: url) }
            return
        }
        if let token = inviteToken(from: url) {
            appEnvironment.pendingDeeplink.setJoinToken(token)
        }
    }

    /// Parses both the custom scheme (`homesplit://join/{token}`) and the
    /// universal link (`https://homesplit.app/join/{token}`) — the invite
    /// builder in `Domain/Deeplinks/Deeplinks.swift` produces the universal
    /// form so the link works in contexts where the app isn't installed yet.
    private func inviteToken(from url: URL) -> String? {
        let components = url.pathComponents.filter { $0 != "/" }
        switch url.scheme {
        case "homesplit":
            if url.host == "join", let token = components.first, !token.isEmpty {
                return token
            }
            if url.host == nil, components.first == "join", components.count >= 2 {
                return components[1]
            }
        case "https", "http":
            guard url.host == "homesplit.app" else { return nil }
            if components.first == "join", components.count >= 2 {
                return components[1]
            }
        default:
            return nil
        }
        return nil
    }
}
