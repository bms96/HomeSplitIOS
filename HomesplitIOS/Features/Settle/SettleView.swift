import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct SettleView: View {
    @Environment(\.app) private var app
    @State private var viewModel: SettleViewModel?
    @State private var pendingPay: Debt?
    @State private var pendingMarkPaid: Debt?
    @State private var deeplinkError: String?

    var body: some View {
        Group {
            if let household = app.householdSession.membership {
                content(household: household)
            } else {
                ContentUnavailableView(
                    "No household",
                    systemImage: "house",
                    description: Text("Create or join a household to settle up.")
                )
            }
        }
        .navigationTitle("Balances")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: app.householdSession.membership?.householdId) {
            await refresh()
        }
    }

    @ViewBuilder
    private func content(household: MembershipWithHousehold) -> some View {
        if let vm = viewModel {
            if vm.isLoading && vm.balances == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.lastError, vm.balances == nil {
                errorState(message: error)
            } else if vm.cycle == nil {
                ContentUnavailableView(
                    "No open cycle",
                    systemImage: "calendar.badge.exclamationmark",
                    description: Text("This household doesn't have an active billing cycle.")
                )
            } else if !vm.hasAnyDebts {
                emptyState
            } else {
                debtList(viewModel: vm, household: household)
            }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var emptyState: some View {
        VStack(spacing: HSSpacing.md) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 44))
                .foregroundStyle(HSColor.success)
            Text("Everyone is settled")
                .font(HSFont.title2)
                .foregroundStyle(HSColor.dark)
            Text("No outstanding balances for this cycle.")
                .font(HSFont.body)
                .foregroundStyle(HSColor.mid)
                .multilineTextAlignment(.center)
                .padding(.horizontal, HSSpacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(HSSpacing.xl)
    }

    private func debtList(viewModel vm: SettleViewModel, household: MembershipWithHousehold) -> some View {
        List {
            if !vm.myDebts.isEmpty {
                Section {
                    ForEach(vm.myDebts, id: \.self) { debt in
                        DebtRow(
                            debt: debt,
                            viewModel: vm,
                            isViewerPerspective: true,
                            isSettling: vm.settlingKey == vm.settleKey(for: debt),
                            onPay: { pendingPay = debt },
                            onMarkPaid: { pendingMarkPaid = debt }
                        )
                    }
                } header: {
                    sectionHeader("Your balances")
                }
            }
            if !vm.otherDebts.isEmpty {
                Section {
                    ForEach(vm.otherDebts, id: \.self) { debt in
                        DebtRow(
                            debt: debt,
                            viewModel: vm,
                            isViewerPerspective: false,
                            isSettling: false,
                            onPay: {},
                            onMarkPaid: {}
                        )
                    }
                } header: {
                    sectionHeader("Between roommates")
                }
            }
            if let error = vm.lastError ?? deeplinkError {
                Section {
                    Text(error)
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.danger)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await refresh() }
        .navigationDestination(for: String.self) { otherMemberId in
            if let uuid = UUID(uuidString: otherMemberId) {
                BalanceBreakdownView(otherMemberId: uuid)
            }
        }
        .confirmationDialog(
            payTitle(for: pendingPay, vm: vm),
            isPresented: Binding(
                get: { pendingPay != nil },
                set: { if !$0 { pendingPay = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let debt = pendingPay {
                Button("Venmo") { openVenmo(debt: debt, household: household) }
                Button("Cash App") { openCashApp(debt: debt) }
                Button("Cancel", role: .cancel) { pendingPay = nil }
            }
        }
        .confirmationDialog(
            markPaidTitle(for: pendingMarkPaid, vm: vm),
            isPresented: Binding(
                get: { pendingMarkPaid != nil },
                set: { if !$0 { pendingMarkPaid = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let debt = pendingMarkPaid {
                Button("Mark paid") {
                    let d = debt
                    pendingMarkPaid = nil
                    Task {
                        await vm.markPaid(d)
                        if let household = app.householdSession.membership {
                            await app.badges.refresh(household: household)
                        }
                    }
                }
                Button("Cancel", role: .cancel) { pendingMarkPaid = nil }
            }
        } message: {
            if let debt = pendingMarkPaid {
                Text(markPaidMessage(for: debt, vm: vm))
            }
        }
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(HSFont.footnote.weight(.semibold))
            .foregroundStyle(HSColor.mid)
            .textCase(.uppercase)
    }

    private func errorState(message: String) -> some View {
        VStack(spacing: HSSpacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(HSColor.danger)
            Text("Couldn't load balances")
                .font(HSFont.title3)
            Text(message)
                .font(HSFont.footnote)
                .foregroundStyle(HSColor.mid)
                .multilineTextAlignment(.center)
                .padding(.horizontal, HSSpacing.xl)
            HSButton(label: "Retry", variant: .secondary) {
                Task { await refresh() }
            }
            .frame(maxWidth: 240)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func payTitle(for debt: Debt?, vm: SettleViewModel) -> String {
        guard let debt else { return "Pay via" }
        let name = vm.member(id: debt.to)?.displayName ?? "Member"
        return "Pay \(name) \(debt.amount.formatted(.currency(code: "USD")))"
    }

    private func markPaidTitle(for debt: Debt?, vm: SettleViewModel) -> String {
        guard let debt else { return "Mark as paid?" }
        let name = vm.member(id: debt.to)?.displayName ?? "them"
        return "Record payment to \(name)?"
    }

    private func markPaidMessage(for debt: Debt, vm: SettleViewModel) -> String {
        let name = vm.member(id: debt.to)?.displayName ?? "them"
        let amount = debt.amount.formatted(.currency(code: "USD"))
        return "Record that you paid \(name) \(amount). This closes all open splits between you two for this cycle."
    }

    private func openVenmo(debt: Debt, household: MembershipWithHousehold) {
        let note = "Homesplit · \(household.household.name)"
        let urlString = Deeplinks.buildVenmoUrl(amount: debt.amount, note: note)
        openURL(urlString, fallback: "Venmo is not installed.")
        pendingPay = nil
    }

    private func openCashApp(debt: Debt) {
        let urlString = Deeplinks.buildCashAppUrl(amount: debt.amount)
        openURL(urlString, fallback: "Cash App is unavailable.")
        pendingPay = nil
    }

    private func openURL(_ string: String, fallback: String) {
        guard let url = URL(string: string) else {
            deeplinkError = fallback
            return
        }
        #if canImport(UIKit)
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
            deeplinkError = nil
        } else {
            deeplinkError = fallback
        }
        #else
        deeplinkError = fallback
        #endif
    }

    private func refresh() async {
        guard let household = app.householdSession.membership else { return }
        if viewModel == nil {
            viewModel = SettleViewModel(
                household: household,
                expensesRepository: app.expenses,
                householdsRepository: app.households,
                balancesRepository: app.balances
            )
        }
        await viewModel?.load()
    }
}

private struct DebtRow: View {
    let debt: Debt
    let viewModel: SettleViewModel
    let isViewerPerspective: Bool
    let isSettling: Bool
    let onPay: () -> Void
    let onMarkPaid: () -> Void

    private var fromName: String {
        viewModel.member(id: debt.from)?.displayName ?? "Former member"
    }

    private var toName: String {
        viewModel.member(id: debt.to)?.displayName ?? "Former member"
    }

    private var youOwe: Bool { viewModel.isViewer(memberId: debt.from) }
    private var owedToYou: Bool { viewModel.isViewer(memberId: debt.to) }

    private var title: String {
        if youOwe { return "You owe \(toName)" }
        if owedToYou { return "\(fromName) owes you" }
        return "\(fromName) owes \(toName)"
    }

    private var otherMemberIdForBreakdown: String {
        youOwe ? debt.to : debt.from
    }

    var body: some View {
        VStack(alignment: .leading, spacing: HSSpacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(HSFont.body.weight(.medium))
                    .foregroundStyle(HSColor.dark)
                Spacer(minLength: HSSpacing.sm)
                Text(debt.amount.formatted(.currency(code: "USD")))
                    .font(HSFont.body.weight(.bold))
                    .foregroundStyle(HSColor.dark)
            }
            if isViewerPerspective {
                HStack(spacing: HSSpacing.md) {
                    if youOwe {
                        Button("Pay", action: onPay)
                            .font(HSFont.subhead.weight(.semibold))
                            .buttonStyle(.borderless)
                            .disabled(isSettling)
                        Button(action: onMarkPaid) {
                            if isSettling {
                                ProgressView().controlSize(.small)
                            } else {
                                Text("Mark paid")
                                    .font(HSFont.subhead.weight(.semibold))
                            }
                        }
                        .buttonStyle(.borderless)
                        .disabled(isSettling)
                    }
                    NavigationLink(value: otherMemberIdForBreakdown) {
                        Text("View expenses")
                            .font(HSFont.subhead.weight(.semibold))
                            .foregroundStyle(HSColor.primary)
                    }
                    .buttonStyle(.borderless)
                }
            }
        }
        .padding(.vertical, HSSpacing.xs)
    }
}
