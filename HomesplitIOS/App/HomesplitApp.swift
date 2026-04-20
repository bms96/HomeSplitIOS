import SwiftUI

@main
struct HomesplitApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .onOpenURL { url in
                    // TODO: route through DeeplinkRouter in Phase 3.
                    _ = url
                }
        }
    }
}
