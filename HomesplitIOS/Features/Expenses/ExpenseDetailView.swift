import SwiftUI

struct ExpenseDetailView: View {
    @Environment(\.app) private var app
    @Environment(\.dismiss) private var dismiss

    let expenseId: UUID
    @State private var viewModel: ExpenseDetailViewModel?
    @State private var isEditing = false
    @State private var isConfirmingDelete = false

    var body: some View {
        Group {
            if let vm = viewModel {
                if vm.isLoading && vm.expense == nil {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let expense = vm.expense, let household = app.householdSession.membership {
                    body(for: expense, household: household, viewModel: vm)
                } else {
                    notFound
                }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle("Expense")
        .navigationBarTitleDisplayMode(.inline)
        .task { await refresh() }
        .onChange(of: viewModel?.didDelete ?? false) { _, didDelete in
            if didDelete { dismiss() }
        }
    }

    private var notFound: some View {
        VStack(spacing: HSSpacing.md) {
            Image(systemName: "questionmark.circle")
                .font(.system(size: 40))
                .foregroundStyle(HSColor.mid)
            Text("Expense not found")
                .font(HSFont.title3)
            HSButton(label: "Back", variant: .secondary) { dismiss() }
                .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func body(
        for expense: ExpenseWithDetails,
        household: MembershipWithHousehold,
        viewModel: ExpenseDetailViewModel
    ) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HSSpacing.lg) {
                infoSection(expense: expense, household: household)
                splitSection(expense: expense, household: household, viewModel: viewModel)
                if let error = viewModel.lastError {
                    Text(error)
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.danger)
                }
                actions(expense: expense, household: household, viewModel: viewModel)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, HSSpacing.screenPadding)
            .padding(.vertical, HSSpacing.lg)
        }
        .toolbar {
            if viewModel.isPayer(memberId: household.id) {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if viewModel.canEdit(memberId: household.id) {
                            Button("Edit", systemImage: "pencil") { isEditing = true }
                        }
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            isConfirmingDelete = true
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("More")
                }
            }
        }
        .confirmationDialog(
            "Delete this expense?",
            isPresented: $isConfirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { _ = await viewModel.delete() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the expense and all of its splits. This cannot be undone.")
        }
        .sheet(isPresented: $isEditing, onDismiss: {
            Task { await refresh() }
        }) {
            EditExpenseView(
                expense: expense,
                members: viewModel.members,
                repository: app.expenses
            )
        }
    }

    private func infoSection(expense: ExpenseWithDetails, household: MembershipWithHousehold) -> some View {
        VStack(alignment: .leading, spacing: HSSpacing.md) {
            if let description = expense.description, !description.isEmpty {
                field(label: "Description", value: description)
            }
            field(label: "Amount", value: expense.amount.formatted(.currency(code: "USD")))
            field(label: "Category", value: expense.category.rawValue.capitalized)
            field(label: "Date", value: expense.date.formatted(date: .abbreviated, time: .omitted))
            if let dueDate = expense.dueDate {
                field(label: "Due date", value: dueDate.formatted(date: .abbreviated, time: .omitted))
            }
            field(
                label: "Paid by",
                value: payerDisplay(expense: expense, household: household)
            )
        }
        .padding(HSSpacing.md)
        .background(HSColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func splitSection(
        expense: ExpenseWithDetails,
        household: MembershipWithHousehold,
        viewModel: ExpenseDetailViewModel
    ) -> some View {
        VStack(alignment: .leading, spacing: HSSpacing.md) {
            Text("Split between")
                .font(HSFont.subhead.weight(.semibold))
                .foregroundStyle(HSColor.dark)
            VStack(spacing: HSSpacing.sm) {
                ForEach(expense.expenseSplits) { split in
                    SplitRowView(
                        split: split,
                        settled: viewModel.splitIsSettled(split),
                        name: displayName(for: split.memberId, viewModel: viewModel, household: household),
                        isViewer: split.memberId == household.id
                    )
                }
            }
        }
        .padding(HSSpacing.md)
        .background(HSColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func actions(
        expense: ExpenseWithDetails,
        household: MembershipWithHousehold,
        viewModel: ExpenseDetailViewModel
    ) -> some View {
        let mySplit = expense.expenseSplits.first { $0.memberId == household.id }
        let myShareUnsettled = mySplit.map { $0.settledAt == nil && $0.memberId != expense.paidByMemberId } ?? false
        if let mySplit, myShareUnsettled {
            HSButton(
                label: viewModel.isMarkingPaid
                    ? "Marking…"
                    : "Mark \(mySplit.amountOwed.formatted(.currency(code: "USD"))) paid",
                loading: viewModel.isMarkingPaid
            ) {
                Task {
                    await viewModel.markMyShareAsPaid(
                        memberId: household.id,
                        householdId: household.householdId
                    )
                    await app.badges.refresh(household: household)
                }
            }
        }
    }

    private func field(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: HSSpacing.xs) {
            Text(label)
                .font(HSFont.caption)
                .foregroundStyle(HSColor.mid)
            Text(value)
                .font(HSFont.body)
                .foregroundStyle(HSColor.dark)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func payerDisplay(expense: ExpenseWithDetails, household: MembershipWithHousehold) -> String {
        let name = expense.paidByMember?.displayName ?? "Unknown"
        return expense.paidByMemberId == household.id ? "\(name) (you)" : name
    }

    private func displayName(
        for memberId: UUID,
        viewModel: ExpenseDetailViewModel,
        household: MembershipWithHousehold
    ) -> String {
        viewModel.members.first { $0.id == memberId }?.displayName ?? "Former member"
    }

    private func refresh() async {
        guard let household = app.householdSession.membership else { return }
        if viewModel == nil {
            viewModel = ExpenseDetailViewModel(
                expenseId: expenseId,
                expensesRepository: app.expenses,
                householdsRepository: app.households
            )
        }
        await viewModel?.load(householdId: household.householdId)
    }
}

private struct SplitRowView: View {
    let split: ExpenseSplit
    let settled: Bool
    let name: String
    let isViewer: Bool

    var body: some View {
        HStack {
            Text(isViewer ? "\(name) (you)" : name)
                .font(HSFont.body)
                .foregroundStyle(HSColor.dark)
            Spacer()
            HStack(spacing: HSSpacing.xs) {
                Text(split.amountOwed.formatted(.currency(code: "USD")))
                    .font(HSFont.body.weight(.medium))
                Text("·")
                    .foregroundStyle(HSColor.mid)
                Text(settled ? "Paid" : "Unpaid")
                    .font(HSFont.footnote.weight(.semibold))
                    .foregroundStyle(settled ? HSColor.success : HSColor.warning)
            }
        }
    }
}
