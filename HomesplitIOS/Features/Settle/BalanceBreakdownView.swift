import SwiftUI

struct BalanceBreakdownView: View {
    @Environment(\.app) private var app
    let otherMemberId: UUID
    @State private var viewModel: BalanceBreakdownViewModel?

    var body: some View {
        Group {
            if let household = app.householdSession.membership {
                content(household: household)
            } else {
                ContentUnavailableView(
                    "No household",
                    systemImage: "house",
                    description: Text("Create or join a household to view balances.")
                )
            }
        }
        .navigationTitle(viewModel?.otherDisplayName ?? "Expenses")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: otherMemberId) { await refresh() }
    }

    @ViewBuilder
    private func content(household: MembershipWithHousehold) -> some View {
        if let vm = viewModel {
            if vm.isLoading && vm.expenses.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.lastError, vm.expenses.isEmpty {
                errorState(message: error)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: HSSpacing.lg) {
                        netCard(vm: vm)
                        if !vm.youOweRows.isEmpty {
                            breakdownSection(
                                title: "You owe",
                                total: vm.youOweTotal,
                                rows: vm.youOweRows
                            )
                        }
                        if !vm.theyOweRows.isEmpty {
                            breakdownSection(
                                title: "\(vm.otherDisplayName) owes you",
                                total: vm.theyOweTotal,
                                rows: vm.theyOweRows
                            )
                        }
                        if vm.youOweRows.isEmpty && vm.theyOweRows.isEmpty {
                            emptyInline
                        } else {
                            mathCard(vm: vm)
                        }
                    }
                    .padding(.horizontal, HSSpacing.screenPadding)
                    .padding(.vertical, HSSpacing.lg)
                }
                .refreshable { await refresh() }
            }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func netCard(vm: BalanceBreakdownViewModel) -> some View {
        VStack(alignment: .leading, spacing: HSSpacing.xs) {
            Text(vm.netLabel)
                .font(HSFont.title3)
                .foregroundStyle(HSColor.dark)
            Text("Unsettled expenses for this cycle only.")
                .font(HSFont.footnote)
                .foregroundStyle(HSColor.mid)
        }
        .padding(HSSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HSColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func breakdownSection(
        title: String,
        total: Decimal,
        rows: [BalanceBreakdownViewModel.Row]
    ) -> some View {
        VStack(alignment: .leading, spacing: HSSpacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(HSFont.footnote.weight(.semibold))
                    .foregroundStyle(HSColor.mid)
                    .textCase(.uppercase)
                Spacer()
                Text(total.formatted(.currency(code: "USD")))
                    .font(HSFont.subhead.weight(.bold))
                    .foregroundStyle(HSColor.dark)
            }
            VStack(spacing: HSSpacing.sm) {
                ForEach(rows) { row in
                    NavigationLink(value: row.expenseId) {
                        ExpenseRowView(row: row)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationDestination(for: UUID.self) { id in
            ExpenseDetailView(expenseId: id)
        }
    }

    private var emptyInline: some View {
        VStack(alignment: .leading, spacing: HSSpacing.xs) {
            Text("No direct unsettled expenses between you.")
                .font(HSFont.footnote.weight(.semibold))
                .foregroundStyle(HSColor.dark)
            Text("The balance may come from debt simplification across the household.")
                .font(HSFont.footnote)
                .foregroundStyle(HSColor.dark)
        }
        .padding(HSSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HSColor.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func mathCard(vm: BalanceBreakdownViewModel) -> some View {
        VStack(spacing: HSSpacing.sm) {
            mathRow(label: "You owe", value: vm.youOweTotal)
            mathRow(label: "\(vm.otherDisplayName) owes you", value: vm.theyOweTotal)
            Divider()
                .background(HSColor.primary.opacity(0.4))
            HStack {
                Text(totalLabel(for: vm))
                    .font(HSFont.callout.weight(.bold))
                    .foregroundStyle(HSColor.primary)
                Spacer()
                Text(netDisplay(for: vm))
                    .font(HSFont.title3.weight(.bold))
                    .foregroundStyle(HSColor.primary)
            }
        }
        .padding(HSSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HSColor.primaryBg)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func mathRow(label: String, value: Decimal) -> some View {
        HStack {
            Text(label)
                .font(HSFont.body)
                .foregroundStyle(HSColor.dark)
            Spacer()
            Text(value.formatted(.currency(code: "USD")))
                .font(HSFont.body.weight(.semibold))
                .foregroundStyle(HSColor.dark)
        }
    }

    private func totalLabel(for vm: BalanceBreakdownViewModel) -> String {
        let threshold = Decimal(string: "0.005") ?? 0
        if vm.net > threshold { return "You owe \(vm.otherDisplayName)" }
        if vm.net < -threshold { return "\(vm.otherDisplayName) owes you" }
        return "Settled"
    }

    private func netDisplay(for vm: BalanceBreakdownViewModel) -> String {
        let absValue = vm.net < 0 ? -vm.net : vm.net
        return absValue.formatted(.currency(code: "USD"))
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

    private func refresh() async {
        guard let household = app.householdSession.membership else { return }
        if viewModel == nil || viewModel?.otherMemberId != otherMemberId {
            viewModel = BalanceBreakdownViewModel(
                otherMemberId: otherMemberId,
                household: household,
                expensesRepository: app.expenses,
                householdsRepository: app.households
            )
        }
        await viewModel?.load()
    }
}

private struct ExpenseRowView: View {
    let row: BalanceBreakdownViewModel.Row

    var body: some View {
        HStack(alignment: .center, spacing: HSSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.description)
                    .font(HSFont.callout.weight(.semibold))
                    .foregroundStyle(HSColor.dark)
                    .lineLimit(1)
                Text(row.date, format: .dateTime.month(.abbreviated).day())
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.mid)
            }
            Spacer()
            Text(row.amount.formatted(.currency(code: "USD")))
                .font(HSFont.callout.weight(.bold))
                .foregroundStyle(HSColor.dark)
        }
        .padding(HSSpacing.md)
        .background(HSColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
