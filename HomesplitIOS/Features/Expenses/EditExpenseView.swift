import SwiftUI

/// Modal sheet for editing an existing expense. Gate access via
/// `ExpenseDetailViewModel.canEdit` — editing is only safe while no split
/// has been settled, because `repository.update` rewrites the split rows.
struct EditExpenseView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel: EditExpenseViewModel
    var onSaved: () -> Void = {}

    init(
        expense: ExpenseWithDetails,
        members: [Member],
        repository: any ExpensesRepositoryProtocol,
        onSaved: @escaping () -> Void = {}
    ) {
        _viewModel = State(
            initialValue: EditExpenseViewModel(
                expense: expense,
                members: members,
                repository: repository
            )
        )
        self.onSaved = onSaved
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Amount") {
                    TextField("0.00", text: $viewModel.amountText)
                        .keyboardType(.decimalPad)
                        .font(HSFont.title2)
                        .accessibilityLabel("Amount in dollars")
                }

                Section("Details") {
                    TextField("Description", text: $viewModel.description)
                        .textInputAutocapitalization(.sentences)

                    Picker("Category", selection: $viewModel.category) {
                        ForEach(ExpenseCategory.allCases, id: \.self) { category in
                            Text(category.rawValue.capitalized).tag(category)
                        }
                    }

                    DatePicker(
                        "Date",
                        selection: $viewModel.date,
                        displayedComponents: .date
                    )

                    Toggle("Has due date", isOn: $viewModel.hasDueDate)

                    if viewModel.hasDueDate {
                        DatePicker(
                            "Due date",
                            selection: Binding(
                                get: { viewModel.dueDate ?? viewModel.date },
                                set: { viewModel.dueDate = $0 }
                            ),
                            displayedComponents: .date
                        )
                    }
                }

                Section("Paid by") {
                    Picker("Paid by", selection: $viewModel.paidByMemberId) {
                        ForEach(viewModel.activeMembers) { member in
                            Text(member.displayName).tag(Optional(member.id))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section {
                    ForEach(viewModel.activeMembers) { member in
                        Button {
                            viewModel.toggleMember(member.id)
                        } label: {
                            HStack {
                                Text(member.displayName)
                                    .foregroundStyle(HSColor.dark)
                                Spacer()
                                if viewModel.selectedMemberIds.contains(member.id) {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(HSColor.primary)
                                }
                            }
                        }
                        .accessibilityAddTraits(.isButton)
                        .accessibilityLabel(
                            viewModel.selectedMemberIds.contains(member.id)
                                ? "\(member.displayName), selected"
                                : member.displayName
                        )
                    }
                } header: {
                    Text("Split between")
                } footer: {
                    Text("Splits equally between the selected members. The first member absorbs rounding so totals match exactly.")
                }

                if let error = viewModel.lastError {
                    Section {
                        Text(error)
                            .foregroundStyle(HSColor.danger)
                            .font(HSFont.footnote)
                    }
                }
            }
            .navigationTitle("Edit expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task {
                            if await viewModel.submit() {
                                onSaved()
                                dismiss()
                            }
                        }
                    } label: {
                        if viewModel.isSubmitting {
                            ProgressView()
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(!viewModel.canSubmit)
                }
            }
        }
    }
}
