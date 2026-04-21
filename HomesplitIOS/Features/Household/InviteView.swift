import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct InviteView: View {
    @Environment(\.app) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var toast: String?
    @State private var showRotateConfirm = false
    @State private var isRotating = false
    @State private var rotateError: String?
    @State private var paywallTrigger: PaywallTrigger?
    @State private var isCheckingPaywall = true
    @State private var didDevBypass = false

    var body: some View {
        Group {
            if let household = app.householdSession.membership?.household {
                if isCheckingPaywall {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content(household: household)
                }
            } else {
                ContentUnavailableView(
                    "No household",
                    systemImage: "house",
                    description: Text("Join or create a household first.")
                )
            }
        }
        .navigationTitle("Invite roommates")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: app.householdSession.membership?.householdId) {
            await evaluatePaywall()
        }
        .sheet(item: $paywallTrigger, onDismiss: {
            if didDevBypass {
                didDevBypass = false
            } else {
                dismiss()
            }
        }) { trigger in
            PaywallGateView(trigger: trigger) {
                didDevBypass = true
            }
        }
    }

    private func evaluatePaywall() async {
        guard let householdId = app.householdSession.membership?.householdId else {
            isCheckingPaywall = false
            return
        }
        isCheckingPaywall = true
        let activeCount: Int
        do {
            activeCount = try await app.households.members(householdId: householdId).count
        } catch {
            activeCount = 0
        }
        if activeCount < 2 {
            isCheckingPaywall = false
            return
        }
        let decision = await app.paywallGate.evaluate(
            householdId: householdId,
            trigger: .thirdMember
        )
        if case .blocked(let trigger) = decision {
            paywallTrigger = trigger
        }
        isCheckingPaywall = false
    }

    @ViewBuilder
    private func content(household: Household) -> some View {
        let inviteUrl = Deeplinks.buildInviteUrl(token: household.inviteToken)

        VStack(alignment: .leading, spacing: HSSpacing.md) {
            Text("Share this link")
                .font(HSFont.title2)
                .foregroundStyle(HSColor.dark)

            Text("Anyone with this link can join your household. Send it to roommates via text, iMessage, WhatsApp, or email.")
                .font(HSFont.body)
                .foregroundStyle(HSColor.mid)

            Button {
                copy(inviteUrl)
            } label: {
                VStack(alignment: .leading, spacing: HSSpacing.xs) {
                    Text(inviteUrl)
                        .font(HSFont.mono)
                        .foregroundStyle(HSColor.dark)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Text("Tap to copy")
                        .font(HSFont.caption.weight(.semibold))
                        .foregroundStyle(HSColor.primary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(HSSpacing.lg)
                .background(HSColor.primaryBg)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Tap to copy invite link: \(inviteUrl)")

            HSButton(label: "Copy link", variant: .secondary) {
                copy(inviteUrl)
            }

            ShareLink(item: inviteUrl, subject: Text("Join our Homesplit household")) {
                Text("Share link")
                    .font(HSFont.body.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .padding(.horizontal, HSSpacing.base)
                    .background(HSColor.primary)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .accessibilityLabel("Share link")

            HSButton(
                label: isRotating ? "Rotating…" : "Rotate link",
                variant: .secondary,
                loading: isRotating
            ) {
                showRotateConfirm = true
            }

            if let rotateError {
                Text(rotateError)
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.danger)
            }

            Spacer()

            if let toast {
                Text(toast)
                    .font(HSFont.subhead.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, HSSpacing.lg)
                    .padding(.vertical, HSSpacing.sm)
                    .background(HSColor.dark.opacity(0.9))
                    .clipShape(Capsule())
                    .frame(maxWidth: .infinity)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .padding(.horizontal, HSSpacing.base)
        .padding(.top, HSSpacing.lg)
        .padding(.bottom, HSSpacing.lg)
        .animation(.easeInOut(duration: 0.2), value: toast)
        .confirmationDialog(
            "Generate a new invite link?",
            isPresented: $showRotateConfirm,
            titleVisibility: .visible
        ) {
            Button("Rotate", role: .destructive) {
                Task { await rotate(householdId: household.id) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The old link will stop working immediately. Anyone who hasn't joined yet will need the new link.")
        }
    }

    private func copy(_ url: String) {
        #if canImport(UIKit)
        UIPasteboard.general.string = url
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
        showToast("Link copied")
    }

    private func rotate(householdId: UUID) async {
        isRotating = true
        rotateError = nil
        defer { isRotating = false }
        do {
            _ = try await app.households.rotateInviteToken(householdId: householdId)
            if let userId = app.auth.user?.id {
                await app.householdSession.refresh(userId: userId)
            }
            #if canImport(UIKit)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            showToast("New link generated")
        } catch {
            rotateError = error.localizedDescription
        }
    }

    private func showToast(_ message: String) {
        toast = message
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            if toast == message { toast = nil }
        }
    }
}

#Preview {
    NavigationStack {
        InviteView()
    }
}
