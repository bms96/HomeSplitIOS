import SwiftUI

struct BillsView: View {
    @Environment(\.app) private var app
    @State private var viewModel: BillsListViewModel?
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
                        description: Text("Create or join a household to track recurring bills.")
                    )
                }
            }
            .navigationTitle("Bills")
            .toolbar {
                if app.householdSession.membership != nil {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            isShowingAddSheet = true
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("Add recurring bill")
                        .disabled(!(viewModel.map { !$0.members.isEmpty } ?? false))
                    }
                }
            }
            .sheet(isPresented: $isShowingAddSheet, onDismiss: {
                Task { await refresh() }
            }) {
                if let household = app.householdSession.membership,
                   let members = viewModel?.members
                {
                    BillFormView(
                        household: household,
                        members: members,
                        repository: app.recurringBills
                    )
                }
            }
        }
        .task(id: app.householdSession.membership?.householdId) {
            await refresh()
        }
    }

    @ViewBuilder
    private func content(household: MembershipWithHousehold) -> some View {
        if let vm = viewModel {
            if vm.isLoading && vm.bills.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = vm.lastError, vm.bills.isEmpty {
                errorState(message: error)
            } else if vm.bills.isEmpty {
                ContentUnavailableView(
                    "No recurring bills yet",
                    systemImage: "calendar.badge.clock",
                    description: Text("Add rent, utilities, or the Wi-Fi bill. Homesplit posts it every cycle for you.")
                )
            } else {
                List {
                    Section {
                        ForEach(vm.bills) { bill in
                            NavigationLink(value: bill.id) {
                                RecurringBillRow(
                                    bill: bill,
                                    paidCount: vm.paidCount(for: bill.id),
                                    includedCount: vm.includedMembers(for: bill).count,
                                    cycleAmount: vm.cycleAmount(for: bill.id),
                                    iPaid: vm.hasPaid(billId: bill.id, memberId: household.id)
                                )
                            }
                        }
                    } header: {
                        VStack(alignment: .leading, spacing: HSSpacing.xs) {
                            Text("Recurring bills")
                                .font(HSFont.title1)
                                .foregroundStyle(HSColor.dark)
                                .textCase(nil)
                            Text("Posted automatically on the due date. Set once, forget about it.")
                                .font(HSFont.subhead)
                                .foregroundStyle(HSColor.mid)
                                .textCase(nil)
                        }
                        .padding(.vertical, HSSpacing.sm)
                    }
                }
                .listStyle(.plain)
                .refreshable { await refresh() }
                .navigationDestination(for: UUID.self) { id in
                    BillDetailView(billId: id)
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
            Text("Couldn't load bills")
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
            viewModel = BillsListViewModel(
                recurringBillsRepository: app.recurringBills,
                expensesRepository: app.expenses,
                householdsRepository: app.households
            )
        }
        await viewModel?.load(householdId: householdId)
    }
}

private struct RecurringBillRow: View {
    let bill: RecurringBill
    let paidCount: Int
    let includedCount: Int
    let cycleAmount: Decimal?
    let iPaid: Bool

    private var effectiveAmount: Decimal? { cycleAmount ?? bill.amount }
    private var daysUntilDue: Int { daysUntil(date: bill.nextDueDate) }
    private var isOverdue: Bool {
        bill.active && BillStatus.isBillEffectivelyOverdue(
            daysUntilDue: daysUntilDue,
            paidCount: paidCount,
            includedCount: includedCount
        )
    }
    private var isUrgent: Bool { bill.active && (daysUntilDue == 0 || daysUntilDue == 1) }
    private var dueLabel: String { bill.active ? formatDueLabel(daysUntilDue) : "Paused" }
    private var frequencyLabel: String {
        BillFrequencyCalculator.formatFrequency(bill.frequency, nextDueDateIso: isoDate(bill.nextDueDate))
    }
    private var metaLabel: String {
        includedCount > 0 ? "\(frequencyLabel) · \(paidCount) of \(includedCount) paid" : frequencyLabel
    }

    var body: some View {
        HStack(alignment: .top, spacing: HSSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: HSSpacing.xs) {
                    Text(bill.name)
                        .font(HSFont.body.weight(.semibold))
                        .foregroundStyle(HSColor.dark)
                        .lineLimit(1)
                    Text("·")
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.mid)
                    Text(dueLabel)
                        .font(HSFont.footnote.weight(.medium))
                        .foregroundStyle(dueLabelColor)
                }
                Text(metaLabel)
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.mid)
            }
            Spacer(minLength: HSSpacing.sm)
            VStack(alignment: .trailing, spacing: HSSpacing.xs) {
                if let amount = effectiveAmount {
                    Text(amount.formatted(.currency(code: "USD")))
                        .font(HSFont.callout.weight(.semibold))
                        .foregroundStyle(HSColor.dark)
                } else {
                    Text("Amount Not Set")
                        .font(HSFont.caption.weight(.bold))
                        .foregroundStyle(HSColor.warning)
                        .padding(.vertical, 2)
                        .padding(.horizontal, HSSpacing.xs)
                        .background(HSColor.warningBg, in: RoundedRectangle(cornerRadius: 4))
                }
                if iPaid {
                    Text("✓ You paid")
                        .font(HSFont.caption.weight(.bold))
                        .foregroundStyle(HSColor.white)
                        .padding(.vertical, 2)
                        .padding(.horizontal, HSSpacing.xs)
                        .background(HSColor.success, in: RoundedRectangle(cornerRadius: 4))
                }
            }
        }
        .padding(.vertical, HSSpacing.xs)
        .listRowBackground(
            iPaid && bill.active && !isOverdue ? HSColor.successBg : Color.clear
        )
    }

    private var dueLabelColor: Color {
        if !bill.active { return HSColor.warning }
        if isOverdue { return HSColor.danger }
        if isUrgent { return HSColor.warning }
        return HSColor.mid
    }
}

private func daysUntil(date: Date) -> Int {
    let calendar = Calendar.current
    let startToday = calendar.startOfDay(for: Date())
    let startTarget = calendar.startOfDay(for: date)
    return calendar.dateComponents([.day], from: startToday, to: startTarget).day ?? 0
}

private func formatDueLabel(_ days: Int) -> String {
    if days < 0 { return "Overdue" }
    if days == 0 { return "Due today" }
    if days == 1 { return "Due tomorrow" }
    return "Due in \(days) days"
}

private func isoDate(_ date: Date) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
    let components = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d",
                  components.year ?? 1970,
                  components.month ?? 1,
                  components.day ?? 1)
}
