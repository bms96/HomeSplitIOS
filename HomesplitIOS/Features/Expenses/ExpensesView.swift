import SwiftUI

struct ExpensesView: View {
    @Environment(\.app) private var app
    @State private var viewModel: ExpensesListViewModel?
    @State private var isShowingAddSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if let household = app.householdSession.membership {
                    content(household: household)
                } else {
                    ContentUnavailableView(
                        "No household",
                        systemImage: "house",
                        description: Text("Create or join a household to track expenses.")
                    )
                }
            }
            .navigationTitle("Expenses")
            .toolbar {
                if app.householdSession.membership != nil {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            isShowingAddSheet = true
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("Add expense")
                        .disabled(!canAddExpense)
                    }
                }
            }
            .sheet(isPresented: $isShowingAddSheet, onDismiss: {
                Task { await refresh() }
            }) {
                if let household = app.householdSession.membership,
                   let cycleId = viewModel?.cycle?.id,
                   let members = viewModel?.members
                {
                    AddExpenseView(
                        household: household,
                        members: members,
                        cycleId: cycleId,
                        repository: app.expenses
                    )
                }
            }
        }
        .task(id: app.householdSession.membership?.householdId) {
            await refresh()
        }
    }

    private var canAddExpense: Bool {
        viewModel?.cycle?.id != nil && !(viewModel?.members.isEmpty ?? true)
    }

    @ViewBuilder
    private func content(household: MembershipWithHousehold) -> some View {
        if let vm = viewModel {
            if vm.isLoading && vm.expenses.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.lastError, vm.expenses.isEmpty {
                errorState(message: error)
            } else if vm.cycle == nil {
                ContentUnavailableView(
                    "No open cycle",
                    systemImage: "calendar.badge.exclamationmark",
                    description: Text("This household doesn't have an active billing cycle.")
                )
            } else if vm.expenses.isEmpty {
                ContentUnavailableView(
                    "No expenses yet",
                    systemImage: "list.bullet.rectangle",
                    description: Text("Tap + to add the first one.")
                )
            } else {
                List(vm.expenses) { expense in
                    NavigationLink(value: expense.id) {
                        ExpenseRow(expense: expense)
                    }
                }
                .listStyle(.plain)
                .refreshable { await refresh() }
                .navigationDestination(for: UUID.self) { id in
                    ExpenseDetailView(expenseId: id)
                }
            }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func errorState(message: String) -> some View {
        VStack(spacing: HSSpacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(HSColor.danger)
            Text("Couldn't load expenses")
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
        guard let householdId = app.householdSession.membership?.householdId else { return }
        if viewModel == nil {
            viewModel = ExpensesListViewModel(
                expensesRepository: app.expenses,
                householdsRepository: app.households
            )
        }
        await viewModel?.load(householdId: householdId)
    }
}

private struct ExpenseRow: View {
    let expense: ExpenseWithDetails

    var body: some View {
        HStack(alignment: .top, spacing: HSSpacing.md) {
            VStack(alignment: .leading, spacing: HSSpacing.xs) {
                Text(expense.description?.isEmpty == false ? expense.description! : expense.category.rawValue.capitalized)
                    .font(HSFont.body.weight(.medium))
                    .foregroundStyle(HSColor.dark)
                HStack(spacing: HSSpacing.xs) {
                    Text(expense.category.rawValue.capitalized)
                    Text("·")
                    Text(expense.date, format: .dateTime.month(.abbreviated).day())
                    if let payer = expense.paidByMember {
                        Text("·")
                        Text("Paid by \(payer.displayName)")
                    }
                }
                .font(HSFont.footnote)
                .foregroundStyle(HSColor.mid)
            }
            Spacer(minLength: HSSpacing.sm)
            Text(expense.amount.formatted(.currency(code: "USD")))
                .font(HSFont.body.weight(.semibold))
                .foregroundStyle(HSColor.dark)
        }
        .padding(.vertical, HSSpacing.xs)
    }
}
