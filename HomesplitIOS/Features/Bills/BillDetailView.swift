import SwiftUI

struct BillDetailView: View {
    @Environment(\.app) private var app
    @Environment(\.dismiss) private var dismiss
    let billId: UUID

    @State private var viewModel: BillDetailViewModel?
    @State private var isShowingEditSheet = false
    @State private var cycleAmountInput: String = ""
    @State private var isEditingCycleAmount = false

    var body: some View {
        Group {
            if let household = app.householdSession.membership {
                content(household: household)
            } else {
                ContentUnavailableView(
                    "No household",
                    systemImage: "house",
                    description: Text("Create or join a household to view bill details.")
                )
            }
        }
        .navigationTitle("Bill")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let vm = viewModel, vm.bill != nil, !vm.isLockedForEdits {
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit") { isShowingEditSheet = true }
                }
            }
        }
        .sheet(isPresented: $isShowingEditSheet, onDismiss: {
            Task { await refresh() }
        }) {
            if let household = app.householdSession.membership,
               let vm = viewModel,
               let bill = vm.bill
            {
                BillFormView(
                    household: household,
                    members: vm.members,
                    existing: bill,
                    repository: app.recurringBills,
                    onSaved: {}
                )
            }
        }
        .task(id: billId) { await refresh() }
    }

    @ViewBuilder
    private func content(household: MembershipWithHousehold) -> some View {
        if let vm = viewModel, let bill = vm.bill {
            List {
                summarySection(bill: bill, vm: vm)
                if vm.isLockedForEdits {
                    lockedSection
                }
                if vm.cycle != nil {
                    cycleSection(bill: bill, vm: vm, household: household)
                }
                if let error = vm.lastError {
                    Section {
                        Text(error)
                            .foregroundStyle(HSColor.danger)
                            .font(HSFont.footnote)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .refreshable { await refresh() }
        } else if viewModel?.lastError != nil {
            errorState(message: viewModel?.lastError ?? "")
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func summarySection(bill: RecurringBill, vm: BillDetailViewModel) -> some View {
        Section("Details") {
            labeledRow("Name", value: bill.name)
            labeledRow("Amount", value: amountLabel(bill: bill, vm: vm))
            labeledRow("Frequency", value: frequencyLabel(bill))
            labeledRow("Next due", value: bill.nextDueDate.formatted(date: .abbreviated, time: .omitted))
            labeledRow("Split method", value: splitMethodLabel(bill.splitType))
            labeledRow("Status", value: bill.active ? "Active" : "Paused")
        }
    }

    private var lockedSection: some View {
        Section {
            Text("Locked for this cycle — someone has marked it paid. Edits unlock next cycle.")
                .font(HSFont.footnote.weight(.semibold))
                .foregroundStyle(HSColor.warning)
        }
    }

    @ViewBuilder
    private func cycleSection(bill: RecurringBill, vm: BillDetailViewModel, household: MembershipWithHousehold) -> some View {
        Section {
            HStack {
                Text("This cycle")
                    .font(HSFont.title3)
                    .foregroundStyle(HSColor.dark)
                Spacer()
                Text("\(vm.paidCount) of \(vm.includedMembers.count) paid")
                    .font(HSFont.footnote.weight(.semibold))
                    .foregroundStyle(HSColor.mid)
            }

            if vm.isVariableAmount {
                cycleAmountRow(vm: vm)
            }

            if vm.needsCycleAmount {
                Text("Variable bill — enter this cycle's amount before anyone can mark paid.")
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.mid)
            } else {
                Text("Tap your row when you've paid your share. Roommates tap their own.")
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.mid)
            }

            if vm.includedMembers.isEmpty {
                Text("No members included.")
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.mid)
            } else {
                ForEach(vm.includedMembers) { member in
                    memberRow(member: member, vm: vm, household: household)
                }
            }
        }
    }

    @ViewBuilder
    private func cycleAmountRow(vm: BillDetailViewModel) -> some View {
        if isEditingCycleAmount || vm.needsCycleAmount {
            VStack(alignment: .leading, spacing: HSSpacing.sm) {
                Text("This cycle's amount")
                    .font(HSFont.subhead)
                    .foregroundStyle(HSColor.mid)
                TextField("47.00", text: $cycleAmountInput)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                HStack {
                    Button {
                        Task {
                            guard let value = Decimal(string: cycleAmountInput, locale: Locale.current),
                                  value > 0
                            else { return }
                            if await vm.setCycleAmount(value) {
                                isEditingCycleAmount = false
                                cycleAmountInput = ""
                            }
                        }
                    } label: {
                        if vm.isSavingAmount {
                            ProgressView()
                        } else {
                            Text("Save amount")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.isSavingAmount)

                    if vm.cycleAmountOverride != nil {
                        Button("Cancel") {
                            isEditingCycleAmount = false
                            cycleAmountInput = ""
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        } else if let amount = vm.effectiveAmount {
            HStack {
                Text("\(amount.formatted(.currency(code: "USD"))) this cycle")
                    .font(HSFont.body.weight(.semibold))
                    .foregroundStyle(HSColor.dark)
                Spacer()
                Button("Edit") {
                    cycleAmountInput = formatDecimalForInput(amount)
                    isEditingCycleAmount = true
                }
                .font(HSFont.subhead.weight(.semibold))
            }
        }
    }

    @ViewBuilder
    private func memberRow(member: Member, vm: BillDetailViewModel, household: MembershipWithHousehold) -> some View {
        let isMe = member.id == household.id
        let paid = vm.hasPaid(memberId: member.id)
        let markBlocked = vm.needsCycleAmount && !paid
        let rowEnabled = isMe && vm.togglingMemberId == nil && !markBlocked
        let share = vm.shareAmount(for: member.id)

        Button {
            guard rowEnabled else { return }
            Task {
                let completed = await vm.toggleMyPayment()
                await app.badges.refresh(household: household)
                if completed { dismiss() }
            }
        } label: {
            HStack(alignment: .center, spacing: HSSpacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(isMe ? "\(member.displayName) (you)" : member.displayName)
                        .font(HSFont.callout.weight(.semibold))
                        .foregroundStyle(HSColor.dark)
                    if let share {
                        Text("Share · \(share.formatted(.currency(code: "USD")))")
                            .font(HSFont.footnote)
                            .foregroundStyle(HSColor.mid)
                    }
                }
                Spacer()
                if vm.togglingMemberId == member.id {
                    ProgressView()
                } else {
                    Text(badgeText(isMe: isMe, paid: paid, needsAmount: vm.needsCycleAmount))
                        .font(HSFont.footnote.weight(.bold))
                        .foregroundStyle(paid ? HSColor.primary : HSColor.mid)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!rowEnabled)
        .listRowBackground(paid ? HSColor.primaryBg : nil)
        .accessibilityAddTraits(isMe ? .isButton : [])
    }

    private func errorState(message: String) -> some View {
        VStack(spacing: HSSpacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(HSColor.danger)
            Text("Couldn't load bill")
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

    private func labeledRow(_ label: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(HSFont.footnote)
                .foregroundStyle(HSColor.mid)
            Spacer()
            Text(value)
                .font(HSFont.body.weight(.semibold))
                .foregroundStyle(HSColor.dark)
                .multilineTextAlignment(.trailing)
        }
    }

    private func refresh() async {
        guard let household = app.householdSession.membership else { return }
        if viewModel == nil {
            viewModel = BillDetailViewModel(
                billId: billId,
                household: household,
                recurringBillsRepository: app.recurringBills,
                expensesRepository: app.expenses,
                householdsRepository: app.households
            )
        }
        await viewModel?.load(householdId: household.householdId)
    }

    private func amountLabel(bill: RecurringBill, vm: BillDetailViewModel) -> String {
        if bill.isVariable {
            if let amount = vm.effectiveAmount {
                return "\(amount.formatted(.currency(code: "USD"))) this cycle (variable)"
            }
            return "Variable (set this cycle's amount)"
        }
        if let amount = vm.effectiveAmount {
            return amount.formatted(.currency(code: "USD"))
        }
        return "—"
    }

    private func frequencyLabel(_ bill: RecurringBill) -> String {
        switch bill.frequency {
        case .weekly:       return "Weekly"
        case .biweekly:     return "Biweekly"
        case .monthly:      return "Monthly"
        case .monthlyFirst: return "1st of every month"
        case .monthlyLast:  return "Last day of every month"
        }
    }

    private func splitMethodLabel(_ type: SplitType) -> String {
        switch type {
        case .equal:           return "Equal"
        case .customPercent:   return "Percentage"
        case .customAmount:    return "Exact amounts"
        }
    }

    private func badgeText(isMe: Bool, paid: Bool, needsAmount: Bool) -> String {
        if paid { return "Paid" }
        if isMe { return needsAmount ? "Add amount first" : "Tap to mark paid" }
        return needsAmount ? "Amount not set" : "Unpaid"
    }

    private func formatDecimalForInput(_ amount: Decimal) -> String {
        var rounded = amount
        var copy = amount
        NSDecimalRound(&rounded, &copy, 2, .bankers)
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        formatter.usesGroupingSeparator = false
        return formatter.string(from: rounded as NSDecimalNumber) ?? "\(rounded)"
    }
}
