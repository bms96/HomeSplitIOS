import SwiftUI

/// Small "DEV" pill anchored below the status bar in non-production builds.
/// Makes it obvious at a glance which database the app is pointing at so we
/// don't accidentally demo prod while pointed at the dev backend (or vice
/// versa once a prod project exists). Hidden entirely when `Configuration.isProd`.
struct DevBadge: View {
    var body: some View {
        if Configuration.isDev {
            Text("DEV · \(Configuration.appEnv.uppercased())")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(HSColor.warning, in: Capsule())
                .accessibilityLabel("Development build")
                .padding(.top, 4)
                .frame(maxWidth: .infinity, alignment: .center)
                .allowsHitTesting(false)
        }
    }
}

extension View {
    /// Overlays a `DevBadge` pinned to the top of the view in non-prod builds.
    /// A no-op in production so there's zero runtime cost to shipping it.
    func devBadgeOverlay() -> some View {
        overlay(alignment: .top) { DevBadge() }
    }
}
