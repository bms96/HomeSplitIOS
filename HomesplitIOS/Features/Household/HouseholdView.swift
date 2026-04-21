import SwiftUI

enum HouseholdRoute: Hashable {
    case settle
    case invite
    case categories
    case settings
    case moveOut
}

struct HouseholdView: View {
    @Environment(\.app) private var app
    @State private var viewModel: HouseholdViewModel?
    @State private var showSignOutConfirm = false
    @State private var isSigningOut = false

    var body: some View {
        NavigationStack {
            Group {
                if let household = app.householdSession.membership {
                    overview(household: household)
                } else {
                    ContentUnavailableView(
                        "No household",
                        systemImage: "house",
                        description: Text("Create or join a household to get started.")
                    )
                }
            }
            .navigationTitle(app.householdSession.membership?.household.name ?? "Household")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: HouseholdRoute.self) { route in
                switch route {
                case .settle:     SettleView()
                case .invite:     InviteView()
                case .categories: CategoriesView()
                case .settings:   SettingsView()
                case .moveOut:    MoveOutFlowView()
                }
            }
        }
        .task(id: app.householdSession.membership?.householdId) {
            await refresh()
        }
    }

    @ViewBuilder
    private func overview(household: MembershipWithHousehold) -> some View {
        let members = viewModel?.members ?? []
        List {
            Section {
                HStack(spacing: HSSpacing.sm) {
                    NavigationLink(value: HouseholdRoute.settle) {
                        quickActionLabel("Settle up", variant: .primary)
                    }
                    .buttonStyle(.plain)
                    NavigationLink(value: HouseholdRoute.settings) {
                        quickActionLabel("Settings", variant: .secondary)
                    }
                    .buttonStyle(.plain)
                }
                .listRowInsets(EdgeInsets(top: HSSpacing.sm, leading: HSSpacing.base, bottom: HSSpacing.md, trailing: HSSpacing.base))
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
            } header: {
                memberCountHeader(members: members)
            }

            Section {
                if let error = viewModel?.lastError {
                    Text(error)
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.danger)
                } else if members.isEmpty && viewModel?.isLoading == true {
                    HStack {
                        ProgressView().controlSize(.small)
                        Text("Loading members…")
                            .font(HSFont.footnote)
                            .foregroundStyle(HSColor.mid)
                    }
                } else {
                    ForEach(members) { member in
                        memberRow(member)
                    }
                }
            } header: {
                sectionHeader("Members")
            }

            Section {
                NavigationLink(value: HouseholdRoute.invite) {
                    Text("Invite roommates")
                        .font(HSFont.body.weight(.medium))
                        .foregroundStyle(HSColor.primary)
                }
                NavigationLink(value: HouseholdRoute.categories) {
                    Text("Manage categories")
                        .font(HSFont.body)
                        .foregroundStyle(HSColor.dark)
                }
                NavigationLink(value: HouseholdRoute.moveOut) {
                    Text("Move out")
                        .font(HSFont.body)
                        .foregroundStyle(HSColor.dark)
                }
            }

            Section {
                Button(role: .destructive) {
                    showSignOutConfirm = true
                } label: {
                    HStack {
                        Text("Sign out")
                        if isSigningOut {
                            Spacer()
                            ProgressView().controlSize(.small)
                        }
                    }
                }
                .disabled(isSigningOut)
            } footer: {
                if let email = app.auth.user?.email {
                    Text("Signed in as \(email)")
                        .font(HSFont.caption)
                        .foregroundStyle(HSColor.mid)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await refresh() }
        .confirmationDialog(
            "Sign out?",
            isPresented: $showSignOutConfirm,
            titleVisibility: .visible
        ) {
            Button("Sign out", role: .destructive) {
                Task {
                    isSigningOut = true
                    await app.auth.signOut()
                    isSigningOut = false
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You can sign back in any time.")
        }
    }

    private func memberCountHeader(members: [Member]) -> some View {
        let count = members.count
        let label = count == 1 ? "1 member" : "\(count) members"
        return Text(label)
            .font(HSFont.subhead)
            .foregroundStyle(HSColor.mid)
            .textCase(nil)
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(HSFont.footnote.weight(.semibold))
            .foregroundStyle(HSColor.mid)
            .textCase(.uppercase)
    }

    private func memberRow(_ member: Member) -> some View {
        HStack(spacing: HSSpacing.md) {
            MemberAvatar(displayName: member.displayName, color: member.color)
            Text(member.displayName)
                .font(HSFont.body)
                .foregroundStyle(HSColor.dark)
            Spacer()
            if member.id == app.householdSession.membership?.id {
                Text("You")
                    .font(HSFont.caption.weight(.semibold))
                    .foregroundStyle(HSColor.primary)
            }
        }
        .padding(.vertical, HSSpacing.xs)
    }

    private func quickActionLabel(_ text: String, variant: HSButtonVariant) -> some View {
        Text(text)
            .font(HSFont.body.weight(.semibold))
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.horizontal, HSSpacing.base)
            .background(quickActionBackground(variant))
            .foregroundStyle(quickActionForeground(variant))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func quickActionBackground(_ variant: HSButtonVariant) -> Color {
        switch variant {
        case .primary:     return HSColor.primary
        case .secondary:   return HSColor.surface
        case .destructive: return HSColor.danger
        }
    }

    private func quickActionForeground(_ variant: HSButtonVariant) -> Color {
        switch variant {
        case .primary, .destructive: return .white
        case .secondary:             return HSColor.dark
        }
    }

    private func refresh() async {
        guard let household = app.householdSession.membership else {
            viewModel = nil
            return
        }
        if viewModel == nil || viewModel?.householdId != household.householdId {
            viewModel = HouseholdViewModel(
                householdId: household.householdId,
                repository: app.households
            )
        }
        await viewModel?.load()
    }
}

#Preview {
    HouseholdView()
}
