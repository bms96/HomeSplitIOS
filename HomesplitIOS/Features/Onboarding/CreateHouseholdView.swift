import SwiftUI

struct CreateHouseholdView: View {
    @Environment(\.app) private var app
    @State private var householdName: String = ""
    @State private var displayName: String = ""
    @State private var householdNameError: String?
    @State private var displayNameError: String?
    @State private var isSubmitting: Bool = false
    @State private var alertMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HSSpacing.lg) {
                Text("Create your household")
                    .font(HSFont.title1)
                    .foregroundStyle(HSColor.dark)

                Text("Name it something your roommates will recognize. You can invite them after.")
                    .font(HSFont.body)
                    .foregroundStyle(HSColor.mid)

                HSTextField(
                    label: "Household name",
                    text: $householdName,
                    placeholder: "e.g. Maple Street",
                    errorMessage: householdNameError,
                    autocapitalization: .words,
                    submitLabel: .next
                )

                HSTextField(
                    label: "Your display name",
                    text: $displayName,
                    placeholder: "What should your roommates call you?",
                    errorMessage: displayNameError,
                    textContentType: .nickname,
                    autocapitalization: .words,
                    submitLabel: .go,
                    onSubmit: submit
                )

                HSButton(
                    label: "Create household",
                    loading: isSubmitting,
                    action: submit
                )

                HSButton(label: "Sign out", variant: .secondary) {
                    Task { await app.auth.signOut() }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, HSSpacing.screenPadding)
            .padding(.vertical, HSSpacing.lg)
        }
        .background(HSColor.white)
        .alert("Couldn't create household",
               isPresented: Binding(
                   get: { alertMessage != nil },
                   set: { if !$0 { alertMessage = nil } }
               )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(alertMessage ?? "")
        }
    }

    private func submit() {
        let trimmedName = householdName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDisplay = displayName.trimmingCharacters(in: .whitespacesAndNewlines)

        householdNameError = trimmedName.isEmpty ? "Enter a household name" : nil
        displayNameError = trimmedDisplay.isEmpty ? "Enter your display name" : nil
        guard householdNameError == nil, displayNameError == nil else { return }

        guard let userId = app.auth.user?.id else {
            alertMessage = "You're not signed in."
            return
        }

        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            do {
                _ = try await app.households.createHousehold(
                    name: trimmedName,
                    displayName: trimmedDisplay,
                    timezone: TimeZone.current.identifier,
                    cycleStartDay: 1
                )
                await app.householdSession.refresh(userId: userId)
            } catch {
                alertMessage = error.localizedDescription
            }
        }
    }
}

#Preview {
    CreateHouseholdView()
}
