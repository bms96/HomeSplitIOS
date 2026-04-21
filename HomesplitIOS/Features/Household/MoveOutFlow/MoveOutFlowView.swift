import SwiftUI

struct MoveOutFlowView: View {
    @Environment(\.app) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: MoveOutFlowViewModel?
    @State private var paywallTrigger: PaywallTrigger?
    @State private var isCheckingPaywall: Bool = true
    @State private var didDevBypass: Bool = false

    var body: some View {
        Group {
            if let household = app.householdSession.membership {
                if isCheckingPaywall {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content(household: household)
                }
            } else {
                ContentUnavailableView(
                    "No household",
                    systemImage: "house",
                    description: Text("Join or create a household first.")
                )
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: app.householdSession.membership?.householdId) {
            guard let householdId = app.householdSession.membership?.householdId else {
                isCheckingPaywall = false
                return
            }
            isCheckingPaywall = true
            let decision = await app.paywallGate.evaluate(
                householdId: householdId,
                trigger: .moveOut
            )
            if case .blocked(let trigger) = decision {
                paywallTrigger = trigger
            }
            isCheckingPaywall = false
        }
        .sheet(item: $paywallTrigger, onDismiss: {
            if didDevBypass {
                didDevBypass = false
            } else {
                dismiss()
            }
        }) { trigger in
            PaywallGateView(trigger: trigger) {
                didDevBypass = true
            }
        }
    }

    private var title: String {
        switch viewModel?.step {
        case .review?: return "Review move-out"
        case .done?:   return "Move-out complete"
        default:       return "Move out"
        }
    }

    @ViewBuilder
    private func content(household: MembershipWithHousehold) -> some View {
        Group {
            if let vm = viewModel {
                switch vm.step {
                case .pick:                pickStep(viewModel: vm)
                case .review:              reviewStep(viewModel: vm)
                case .done(let summary):   doneStep(summary: summary)
                }
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task(id: household.householdId) {
            if viewModel == nil {
                viewModel = MoveOutFlowViewModel(
                    household: household,
                    householdsRepo: app.households,
                    expensesRepo: app.expenses,
                    moveOutsRepo: app.moveOuts
                )
                await viewModel?.load()
            }
        }
    }

    // MARK: - Pick step

    @ViewBuilder
    private func pickStep(viewModel vm: MoveOutFlowViewModel) -> some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: HSSpacing.md) {
                    Text("Who is moving out?")
                        .font(HSFont.title2)
                        .foregroundStyle(HSColor.dark)

                    if vm.isLoading && vm.members.isEmpty {
                        HStack {
                            ProgressView().controlSize(.small)
                            Text("Loading…").font(HSFont.footnote).foregroundStyle(HSColor.mid)
                        }
                    }

                    ForEach(vm.members) { member in
                        memberRow(member, viewModel: vm)
                    }

                    DatePicker(
                        "Move-out date",
                        selection: Binding(
                            get: { vm.moveOutDate },
                            set: { vm.moveOutDate = $0; vm.dateError = nil }
                        ),
                        in: dateRange(viewModel: vm),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)
                    .padding(.top, HSSpacing.sm)

                    if let dateError = vm.dateError {
                        Text(dateError)
                            .font(HSFont.footnote)
                            .foregroundStyle(HSColor.danger)
                    }

                    Text("Defaults to today. The final cycle will be prorated by days-present.")
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.mid)

                    if let error = vm.lastError {
                        Text(error)
                            .font(HSFont.footnote)
                            .foregroundStyle(HSColor.danger)
                    }
                }
                .padding(.horizontal, HSSpacing.base)
                .padding(.top, HSSpacing.lg)
                .padding(.bottom, HSSpacing.xl)
            }

            footerBar {
                HSButton(
                    label: "Review",
                    isEnabled: vm.selectedMemberId != nil && vm.cycle != nil && !vm.isLoading
                ) {
                    vm.goToReview()
                }
                HSButton(label: "Cancel", variant: .secondary) { dismiss() }
            }
        }
    }

    private func memberRow(_ member: Member, viewModel vm: MoveOutFlowViewModel) -> some View {
        let selected = member.id == vm.selectedMemberId
        return Button {
            vm.selectedMemberId = member.id
        } label: {
            HStack(spacing: HSSpacing.md) {
                MemberAvatar(displayName: member.displayName, color: member.color, size: 32)
                Text(member.displayName + (member.id == vm.household.id ? " (you)" : ""))
                    .font(HSFont.body)
                    .foregroundStyle(HSColor.dark)
                Spacer()
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(HSColor.primary)
                }
            }
            .padding(HSSpacing.md)
            .background(selected ? HSColor.primaryBg : HSColor.white)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(selected ? HSColor.primary : HSColor.light.opacity(0.5), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("Select \(member.displayName)")
    }

    private func dateRange(viewModel vm: MoveOutFlowViewModel) -> ClosedRange<Date> {
        let start = vm.cycle?.startDate ?? Date(timeIntervalSince1970: 0)
        let end = vm.cycle?.endDate ?? Date().addingTimeInterval(60 * 60 * 24 * 365)
        let far = max(end, Date().addingTimeInterval(60 * 60 * 24 * 30))
        return start...far
    }

    // MARK: - Review step

    private func reviewStep(viewModel vm: MoveOutFlowViewModel) -> some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: HSSpacing.md) {
                    Text("Confirm")
                        .font(HSFont.title2)
                        .foregroundStyle(HSColor.dark)

                    VStack(alignment: .leading, spacing: HSSpacing.sm) {
                        reviewRow("Departing", vm.selectedMember?.displayName ?? "—")
                        reviewRow("Move-out date", vm.moveOutDate.formatted(date: .abbreviated, time: .omitted))
                        if let present = vm.daysPresent, let total = vm.cycleTotalDays, let cycle = vm.cycle {
                            reviewRow(
                                "Cycle",
                                "\(cycle.startDate.formatted(date: .abbreviated, time: .omitted)) – \(cycle.endDate.formatted(date: .abbreviated, time: .omitted)) · \(present)/\(total) days"
                            )
                        }
                    }
                    .padding(HSSpacing.md)
                    .background(HSColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Text(explainerText(viewModel: vm))
                        .font(HSFont.body)
                        .foregroundStyle(HSColor.dark)

                    Text("This does not collect payment. Use Settle up to send any outstanding balance after.")
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.mid)

                    if let error = vm.lastError {
                        Text(error)
                            .font(HSFont.footnote)
                            .foregroundStyle(HSColor.danger)
                    }
                }
                .padding(.horizontal, HSSpacing.base)
                .padding(.top, HSSpacing.lg)
                .padding(.bottom, HSSpacing.xl)
            }

            footerBar {
                HSButton(
                    label: vm.isFinalizing ? "Finalizing…" : "Confirm move-out",
                    loading: vm.isFinalizing,
                    isEnabled: !vm.isFinalizing
                ) {
                    Task { await vm.confirm() }
                }
                HSButton(
                    label: "Back",
                    variant: .secondary,
                    isEnabled: !vm.isFinalizing
                ) {
                    vm.goBackToPick()
                }
            }
        }
    }

    private func explainerText(viewModel vm: MoveOutFlowViewModel) -> String {
        let days: String
        if let p = vm.daysPresent, let t = vm.cycleTotalDays {
            days = "\(p)/\(t)"
        } else {
            days = "days-present"
        }
        return "Recurring bills in this cycle will be prorated to \(days) of each split. One-time expenses after the move-out date will be removed from their share. The freed amount is redistributed across the remaining roommates."
    }

    private func reviewRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(HSFont.footnote)
                .foregroundStyle(HSColor.mid)
            Text(value)
                .font(HSFont.body.weight(.semibold))
                .foregroundStyle(HSColor.dark)
        }
    }

    // MARK: - Done step

    private func doneStep(summary: MoveOutFlowViewModel.DoneSummary) -> some View {
        VStack(spacing: HSSpacing.lg) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 48))
                .foregroundStyle(HSColor.success)

            Text("Move-out complete")
                .font(HSFont.title2)

            Text("\(summary.departingName)'s splits have been prorated and their spot is closed out.")
                .font(HSFont.body)
                .foregroundStyle(HSColor.dark)
                .multilineTextAlignment(.center)
                .padding(.horizontal, HSSpacing.xl)

            VStack(alignment: .leading, spacing: HSSpacing.xs) {
                Text("Settlement")
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.mid)
                Text(summary.moveOut.settlementAmount.formatted(.currency(code: "USD")))
                    .font(HSFont.title3)
                Text("\(summary.moveOut.proratedDaysPresent) of \(summary.moveOut.cycleTotalDays) days present")
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.mid)
            }
            .padding(HSSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(HSColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, HSSpacing.base)

            if let pdfURL = summary.localPDFURL {
                ShareLink(item: pdfURL) {
                    Text("Share settlement PDF")
                        .font(HSFont.body.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .padding(.horizontal, HSSpacing.base)
                        .background(HSColor.primary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, HSSpacing.base)
            }

            HSButton(label: "Done", variant: .secondary) {
                Task {
                    if let userId = app.auth.user?.id {
                        await app.householdSession.refresh(userId: userId)
                    }
                    dismiss()
                }
            }
            .padding(.horizontal, HSSpacing.base)

            Spacer()
        }
        .padding(.top, HSSpacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func footerBar<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: HSSpacing.sm) {
            content()
        }
        .padding(.horizontal, HSSpacing.base)
        .padding(.vertical, HSSpacing.md)
        .background(
            HSColor.white
                .overlay(Rectangle().frame(height: 1).foregroundStyle(HSColor.surface), alignment: .top)
        )
    }
}

#Preview {
    NavigationStack { MoveOutFlowView() }
}
