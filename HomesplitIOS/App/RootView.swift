import SwiftUI

struct RootView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "house.fill")
                .font(.system(size: 48))
                .foregroundStyle(.tint)
                .accessibilityHidden(true)

            Text("Homesplit")
                .font(.largeTitle.bold())

            Text("Phase 0 bootstrap — native iOS scaffold is up.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Text("Environment: \(Configuration.appEnv)")
                .font(.footnote.monospaced())
                .foregroundStyle(.tertiary)
        }
        .padding()
    }
}

#Preview {
    RootView()
}
