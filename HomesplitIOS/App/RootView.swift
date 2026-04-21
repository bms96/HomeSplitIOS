import SwiftUI

struct RootView: View {
    @Environment(\.app) private var app

    private var joinSheetBinding: Binding<Bool> {
        Binding(
            get: {
                app.auth.isInitialized
                    && app.auth.isSignedIn
                    && app.householdSession.isLoaded
                    && app.pendingDeeplink.joinToken != nil
            },
            set: { showing in
                if !showing { app.pendingDeeplink.clear() }
            }
        )
    }

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
        .sheet(isPresented: joinSheetBinding) {
            if let token = app.pendingDeeplink.joinToken {
                JoinHouseholdView(token: token)
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
