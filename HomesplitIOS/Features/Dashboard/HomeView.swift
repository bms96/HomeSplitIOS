import SwiftUI

struct HomeView: View {
    @Environment(\.app) private var app
    @State private var viewModel: HomeViewModel?

    var body: some View {
        NavigationStack {
            ScrollView {
                content
                    .padding(.horizontal, HSSpacing.screenPadding)
                    .padding(.vertical, HSSpacing.lg)
            }
            .navigationTitle("Home")
            .refreshable { await refresh() }
            .navigationDestination(for: HomeRoute.self) { route in
                switch route {
                case .settle:
                    SettleView()
                }
            }
        }
        .task(id: app.householdSession.membership?.id) {
            await refresh()
        }
    }

    enum HomeRoute: Hashable { case settle }

    @ViewBuilder
    private var content: some View {
        if let household = app.householdSession.membership, let vm = viewModel {
            VStack(alignment: .leading, spacing: HSSpacing.lg) {
                greeting(household: household)
                cards(household: household, viewModel: vm)
                owedSection(household: household, viewModel: vm)
                if let error = vm.lastError {
                    Text(error)
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.danger)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if app.householdSession.membership == nil {
            ContentUnavailableView(
                "No household",
                systemImage: "house",
                description: Text("Create or join a household to see balances.")
            )
        } else {
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.top, HSSpacing.xxl)
        }
    }

    private func greeting(household: MembershipWithHousehold) -> some View {
        VStack(alignment: .leading, spacing: HSSpacing.xs) {
            Text("Hi, \(household.displayName)")
                .font(HSFont.title1)
                .foregroundStyle(HSColor.dark)
            Text(household.household.name)
                .font(HSFont.subhead)
                .foregroundStyle(HSColor.mid)
        }
    }

    private func cards(household: MembershipWithHousehold, viewModel: HomeViewModel) -> some View {
        let counts = viewModel.viewerCounts(memberId: household.id)
        let youOwe = viewModel.youOweCard(memberId: household.id)
        let owedToYou = viewModel.owedToYouCard(memberId: household.id)
        return HStack(spacing: HSSpacing.md) {
            NavigationLink(value: HomeRoute.settle) {
                StatCard(
                    label: "You owe",
                    count: counts.iOwe.count,
                    amount: counts.iOwe.amount,
                    state: youOwe,
                    isLoading: viewModel.isLoading && viewModel.expenses.isEmpty
                )
            }
            .buttonStyle(.plain)
            NavigationLink(value: HomeRoute.settle) {
                StatCard(
                    label: "Owed to you",
                    count: counts.owedToMe.count,
                    amount: counts.owedToMe.amount,
                    state: owedToYou,
                    isLoading: viewModel.isLoading && viewModel.expenses.isEmpty
                )
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func owedSection(household: MembershipWithHousehold, viewModel: HomeViewModel) -> some View {
        let items = viewModel.owedByMe(memberId: household.id)
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: HSSpacing.md) {
                Text("You owe")
                    .font(HSFont.title3)
                    .foregroundStyle(HSColor.dark)
                VStack(spacing: HSSpacing.sm) {
                    ForEach(items) { item in
                        OwedRow(
                            item: item,
                            isPaying: viewModel.settlingSplitId == item.mySplitId
                        ) {
                            Task {
                                await viewModel.markMyShareAsPaid(
                                    splitId: item.mySplitId,
                                    household: household
                                )
                                await app.badges.refresh(household: household)
                            }
                        }
                    }
                }
            }
        }
    }

    private func refresh() async {
        guard let household = app.householdSession.membership else { return }
        if viewModel == nil {
            viewModel = HomeViewModel(
                expensesRepository: app.expenses,
                householdsRepository: app.households,
                balancesRepository: app.balances
            )
        }
        await viewModel?.load(household: household)
    }
}

private struct StatCard: View {
    let label: String
    let count: Int
    let amount: Decimal
    let state: StatCardState
    let isLoading: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: HSSpacing.sm) {
            HStack {
                Text(label)
                    .font(HSFont.subhead.weight(.semibold))
                    .foregroundStyle(accent)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(accent)
            }
            if isLoading {
                ProgressView()
                    .frame(height: 32)
            } else {
                Text("\(count)")
                    .font(HSFont.title1)
                    .foregroundStyle(HSColor.dark)
                Text(amount.formatted(.currency(code: "USD")))
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.mid)
            }
            Text(state.text)
                .font(HSFont.caption.weight(.medium))
                .foregroundStyle(accent)
        }
        .padding(HSSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(background)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(accent, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label), \(count) expenses, \(amount.formatted(.currency(code: "USD"))). \(state.text).")
    }

    private var accent: Color {
        switch state.tone {
        case .positive: return HSColor.success
        case .caution:  return HSColor.warning
        case .alert:    return HSColor.danger
        }
    }

    private var background: Color {
        switch state.tone {
        case .positive: return HSColor.successBg
        case .caution:  return HSColor.warningBg
        case .alert:    return HSColor.dangerBg
        }
    }
}

private struct OwedRow: View {
    let item: HomeViewModel.OwedExpenseItem
    let isPaying: Bool
    let onMarkPaid: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: HSSpacing.md) {
            VStack(alignment: .leading, spacing: HSSpacing.xs) {
                Text(item.name)
                    .font(HSFont.body.weight(.medium))
                    .foregroundStyle(HSColor.dark)
                HStack(spacing: HSSpacing.xs) {
                    if let payer = item.payerName {
                        Text("To \(payer)")
                    }
                    Text("·")
                    Text(item.date, format: .dateTime.month(.abbreviated).day())
                }
                .font(HSFont.footnote)
                .foregroundStyle(HSColor.mid)
            }
            Spacer(minLength: HSSpacing.sm)
            VStack(alignment: .trailing, spacing: HSSpacing.xs) {
                Text(item.myShare.formatted(.currency(code: "USD")))
                    .font(HSFont.body.weight(.semibold))
                    .foregroundStyle(HSColor.dark)
                Button(action: onMarkPaid) {
                    if isPaying {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("Mark paid")
                            .font(HSFont.footnote.weight(.semibold))
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(isPaying)
                .accessibilityLabel("Mark \(item.name) paid")
            }
        }
        .padding(HSSpacing.md)
        .background(HSColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
