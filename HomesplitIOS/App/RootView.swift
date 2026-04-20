import SwiftUI

struct RootView: View {
    @Environment(\.app) private var app

    var body: some View {
        Group {
            if !app.auth.isInitialized {
                loading
            } else if !app.auth.isSignedIn {
                SignInView()
            } else if !app.householdSession.isLoaded {
                loading
            } else if app.householdSession.hasHousehold {
                MainTabView()
            } else {
                CreateHouseholdView()
            }
        }
        .task {
            await app.auth.initialize()
        }
        .task(id: app.auth.user?.id) {
            if let userId = app.auth.user?.id {
                await app.householdSession.refresh(userId: userId)
            } else {
                app.householdSession.clear()
            }
        }
    }

    private var loading: some View {
        ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(HSColor.white)
    }
}

#Preview {
    RootView()
}
