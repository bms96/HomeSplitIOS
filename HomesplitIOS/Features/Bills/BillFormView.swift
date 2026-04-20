import SwiftUI

/// Modal sheet for adding or editing a recurring bill. Equal-split only at
/// MVP — custom_amt / custom_pct arrive with the detail-screen cycle tooling.
struct BillFormView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: BillFormViewModel
    @State private var showDeleteConfirm = false
    private let onSaved: () -> Void

    init(
        household: MembershipWithHousehold,
        members: [Member],
        existing: RecurringBill? = nil,
        repository: any RecurringBillsRepositoryProtocol,
        onSaved: @escaping () -> Void = {}
    ) {
        _viewModel = State(
            initialValue: BillFormViewModel(
                household: household,
                members: members,
                existing: existing,
                repository: repository
            )
        )
        self.onSaved = onSaved
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Rent, Internet, PG&E", text: $viewModel.name)
                        .textInputAutocapitalization(.words)
                }

                Section {
                    TextField("1500.00", text: $viewModel.amountText)
                        .keyboardType(.decimalPad)
                        .font(HSFont.title2)
                        .accessibilityLabel("Amount in dollars")
                } header: {
                    Text("Amount")
                } footer: {
                    Text(viewModel.isVariableAmount
                         ? "Leave blank for variable — you'll set each cycle's amount from the bill's detail screen."
                         : "Fixed amount billed every cycle.")
                }

                Section("Frequency") {
                    Picker("Frequency", selection: $viewModel.frequency) {
                        ForEach(BillFrequency.allCases, id: \.self) { freq in
                            Text(Self.label(for: freq)).tag(freq)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section {
                    DatePicker(
                        "Due date",
                        selection: $viewModel.nextDueDate,
                        displayedComponents: .date
                    )
                } header: {
                    Text("Next due")
                } footer: {
                    Text(dueDateFooter)
                }

                Section {
                    Toggle("Active", isOn: $viewModel.active)
                } footer: {
                    Text("When off, this bill stops showing in upcoming.")
                }

                Section {
                    ForEach(viewModel.members) { member in
                        Button {
                            viewModel.toggleMember(member.id)
                        } label: {
                            HStack {
                                Text(member.displayName)
                                    .foregroundStyle(HSColor.dark)
                                Spacer()
                                if viewModel.includedMemberIds.contains(member.id) {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(HSColor.primary)
                                }
                            }
                        }
                        .accessibilityAddTraits(.isButton)
                        .accessibilityLabel(
                            viewModel.includedMemberIds.contains(member.id)
                                ? "\(member.displayName), included"
                                : member.displayName
                        )
                    }
                } header: {
                    Text("Split between")
                } footer: {
                    Text("Splits equally between the selected members. The first member absorbs rounding so totals match exactly.")
                }

                if viewModel.isEditing {
                    Section {
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            HStack {
                                Spacer()
                                if viewModel.isDeleting {
                                    ProgressView()
                                } else {
                                    Text("Delete bill")
                                }
                                Spacer()
                            }
                        }
                        .disabled(viewModel.isDeleting)
                    }
                }

                if let error = viewModel.lastError {
                    Section {
                        Text(error)
                            .foregroundStyle(HSColor.danger)
                            .font(HSFont.footnote)
                    }
                }
            }
            .navigationTitle(viewModel.isEditing ? "Edit bill" : "Add bill")
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
            .confirmationDialog(
                "Delete this bill?",
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    Task {
                        if await viewModel.delete() {
                            onSaved()
                            dismiss()
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("It will stop tracking payments. Past cycles are not affected.")
            }
        }
    }

    private var dueDateFooter: String {
        switch viewModel.frequency {
        case .weekly:        return "First posting runs on this date; recurs every 7 days."
        case .biweekly:      return "First posting runs on this date; recurs every 14 days."
        case .monthly:       return "Recurs on this day of the month. Clamps for short months (Jan 31 → Feb 28)."
        case .monthlyFirst:  return "Anchored — always posts on the 1st of every month."
        case .monthlyLast:   return "Anchored — always posts on the last day of every month."
        }
    }

    private static func label(for frequency: BillFrequency) -> String {
        switch frequency {
        case .weekly:       return "Weekly"
        case .biweekly:     return "Biweekly"
        case .monthly:      return "Monthly"
        case .monthlyFirst: return "1st of month"
        case .monthlyLast:  return "Last of month"
        }
    }
}
