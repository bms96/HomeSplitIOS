import SwiftUI

@main
struct HomesplitApp: App {
    @State private var appEnvironment = AppEnvironment.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(\.app, appEnvironment)
                .onOpenURL { url in
                    if url.host == "auth-callback" {
                        Task { await appEnvironment.auth.handleAuthCallback(url: url) }
                    }
                }
        }
    }
}
