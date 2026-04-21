import SwiftUI

/// Fallback paywall shown when the RevenueCat SDK isn't linked (dev builds,
/// previews, CI). Mirrors `app/(app)/paywall.tsx` from the RN reference —
/// Pro pitch, explainer that the real paywall requires a dev build with the
/// SDK, and a dismiss button. Once the SPM wiring lands, `PaywallGateService`
/// will prefer `presentPaywall()` and this sheet only appears when the live
/// paywall is truly unavailable.
struct PaywallGateView: View {
    @Environment(\.dismiss) private var dismiss
    let trigger: PaywallTrigger
    /// Invoked when the user taps the dev-bypass button. The sheet dismisses
    /// automatically after the closure runs; callers decide whether to
    /// proceed with the gated action. Only visible in non-prod builds.
    var onDevBypass: (() -> Void)? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: HSSpacing.lg) {
                    VStack(alignment: .leading, spacing: HSSpacing.sm) {
                        Text("Homesplit Pro")
                            .font(HSFont.title1)
                            .foregroundStyle(HSColor.dark)
                        Text(trigger.title)
                            .font(HSFont.title3)
                            .foregroundStyle(HSColor.primary)
                    }

                    Text(trigger.body)
                        .font(HSFont.body)
                        .foregroundStyle(HSColor.dark)

                    VStack(alignment: .leading, spacing: HSSpacing.sm) {
                        bullet("Unlimited roommates")
                        bullet("Unlimited recurring bills")
                        bullet("Automated move-out flow with prorated settlement")
                    }
                    .padding(HSSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(HSColor.primaryBg)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Text("The in-app purchase requires a development build with the RevenueCat SDK linked. Once that's wired, tapping Upgrade will show live pricing.")
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.mid)

                    VStack(spacing: HSSpacing.sm) {
                        if Configuration.isDev, let onDevBypass {
                            HSButton(label: "Dev bypass — continue", variant: .secondary) {
                                onDevBypass()
                                dismiss()
                            }
                            .accessibilityLabel("Dev bypass paywall")
                        }
                        HSButton(label: "Not now", variant: .secondary) { dismiss() }
                    }
                    .padding(.top, HSSpacing.md)
                }
                .padding(.horizontal, HSSpacing.base)
                .padding(.top, HSSpacing.lg)
                .padding(.bottom, HSSpacing.xl)
            }
            .navigationTitle("Upgrade")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: HSSpacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(HSColor.primary)
            Text(text)
                .font(HSFont.body)
                .foregroundStyle(HSColor.dark)
        }
    }
}

#Preview {
    PaywallGateView(trigger: .thirdMember)
}
