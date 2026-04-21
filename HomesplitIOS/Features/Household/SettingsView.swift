import SwiftUI

struct SettingsView: View {
    @Environment(\.app) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var householdName: String = ""
    @State private var displayName: String = ""
    @State private var isSaving: Bool = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let membership = app.householdSession.membership {
                form(membership: membership)
            } else {
                ContentUnavailableView(
                    "No household",
                    systemImage: "house",
                    description: Text("Join or create a household first.")
                )
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { seed() }
    }

    @ViewBuilder
    private func form(membership: MembershipWithHousehold) -> some View {
        let trimmedHousehold = householdName.trimmingCharacters(in: .whitespaces)
        let trimmedDisplay = displayName.trimmingCharacters(in: .whitespaces)
        let canSave =
            (!trimmedHousehold.isEmpty && trimmedHousehold != membership.household.name) ||
            (!trimmedDisplay.isEmpty && trimmedDisplay != membership.displayName)

        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: HSSpacing.md) {
                    sectionHeader("Household")
                    HSTextField(
                        label: "Name",
                        text: $householdName,
                        placeholder: "The apartment",
                        autocapitalization: .words
                    )

                    sectionHeader("You")
                    HSTextField(
                        label: "Your display name",
                        text: $displayName,
                        placeholder: "Alex",
                        autocapitalization: .words
                    )

                    if let errorMessage {
                        Text(errorMessage)
                            .font(HSFont.footnote)
                            .foregroundStyle(HSColor.danger)
                    }
                }
                .padding(.horizontal, HSSpacing.base)
                .padding(.top, HSSpacing.lg)
                .padding(.bottom, HSSpacing.xl)
            }

            VStack(spacing: HSSpacing.sm) {
                HSButton(
                    label: isSaving ? "Saving…" : "Save",
                    loading: isSaving,
                    isEnabled: canSave && !isSaving
                ) {
                    Task { await save(membership: membership) }
                }
                HSButton(label: "Cancel", variant: .secondary) {
                    dismiss()
                }
            }
            .padding(.horizontal, HSSpacing.base)
            .padding(.vertical, HSSpacing.md)
            .background(
                HSColor.white
                    .overlay(Rectangle().frame(height: 1).foregroundStyle(HSColor.surface), alignment: .top)
            )
        }
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(HSFont.footnote.weight(.semibold))
            .foregroundStyle(HSColor.mid)
            .textCase(.uppercase)
            .padding(.top, HSSpacing.sm)
    }

    private func seed() {
        guard let membership = app.householdSession.membership else { return }
        if householdName.isEmpty { householdName = membership.household.name }
        if displayName.isEmpty { displayName = membership.displayName }
    }

    private func save(membership: MembershipWithHousehold) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let newHouseholdName = householdName.trimmingCharacters(in: .whitespaces)
        let newDisplayName = displayName.trimmingCharacters(in: .whitespaces)

        do {
            if !newHouseholdName.isEmpty && newHouseholdName != membership.household.name {
                try await app.households.updateHouseholdName(
                    householdId: membership.householdId,
                    name: newHouseholdName
                )
            }
            if !newDisplayName.isEmpty && newDisplayName != membership.displayName {
                try await app.households.updateMemberDisplayName(
                    memberId: membership.id,
                    displayName: newDisplayName
                )
            }
            if let userId = app.auth.user?.id {
                await app.householdSession.refresh(userId: userId)
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
}
