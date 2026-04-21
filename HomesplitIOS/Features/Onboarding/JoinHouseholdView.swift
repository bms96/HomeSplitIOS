import SwiftUI

/// Handles the `homesplit://join/{token}` / universal-link return path.
/// Consumes the token from `PendingDeeplink`, calls `join_household_by_token`,
/// refreshes the household session, then dismisses. If the user already has a
/// household, the RPC rejects the join and we surface the error — switching
/// households is an explicit flow we don't support at MVP.
struct JoinHouseholdView: View {
    @Environment(\.app) private var app
    @Environment(\.dismiss) private var dismiss

    let token: String

    @State private var isJoining = true
    @State private var errorMessage: String?
    @State private var didAttempt = false

    var body: some View {
        NavigationStack {
            VStack(spacing: HSSpacing.lg) {
                if isJoining {
                    ProgressView()
                        .controlSize(.large)
                    Text("Joining household…")
                        .font(HSFont.body)
                        .foregroundStyle(HSColor.mid)
                } else if let errorMessage {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(HSColor.danger)
                    Text("Couldn't join")
                        .font(HSFont.title2)
                        .foregroundStyle(HSColor.dark)
                    Text(errorMessage)
                        .font(HSFont.body)
                        .foregroundStyle(HSColor.mid)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, HSSpacing.lg)
                    HSButton(label: "Close", variant: .secondary) {
                        app.pendingDeeplink.clear()
                        dismiss()
                    }
                    .frame(maxWidth: 240)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(HSColor.white)
            .navigationTitle("Join household")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        app.pendingDeeplink.clear()
                        dismiss()
                    }
                    .disabled(isJoining)
                }
            }
            .task {
                guard !didAttempt else { return }
                didAttempt = true
                await attemptJoin()
            }
        }
    }

    private func attemptJoin() async {
        isJoining = true
        errorMessage = nil
        do {
            _ = try await app.households.joinHousehold(token: token)
            if let userId = app.auth.user?.id {
                await app.householdSession.refresh(userId: userId)
            }
            app.pendingDeeplink.clear()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            isJoining = false
        }
    }
}
