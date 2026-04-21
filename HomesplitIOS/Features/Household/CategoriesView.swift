import SwiftUI

struct CategoriesView: View {
    @Environment(\.app) private var app
    @State private var viewModel: CategoriesViewModel?
    @State private var editing: ExpenseCategory?
    @State private var draftLabel: String = ""

    var body: some View {
        Group {
            if app.householdSession.membership != nil {
                content
            } else {
                ContentUnavailableView(
                    "No household",
                    systemImage: "house",
                    description: Text("Join or create a household first.")
                )
            }
        }
        .navigationTitle("Categories")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: app.householdSession.membership?.householdId) {
            await refresh()
        }
    }

    @ViewBuilder
    private var content: some View {
        if let vm = viewModel {
            List {
                Section {
                    Text("Rename or hide categories for this household. Hidden categories won't appear when adding expenses. Existing expenses keep their category.")
                        .font(HSFont.footnote)
                        .foregroundStyle(HSColor.mid)
                }
                .listRowBackground(Color.clear)

                if vm.isLoading && vm.prefs.isEmpty {
                    Section {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                        .listRowBackground(Color.clear)
                    }
                }

                Section {
                    ForEach(vm.displays, id: \.value) { display in
                        categoryRow(display, viewModel: vm)
                    }
                }

                if let error = vm.lastError {
                    Section {
                        Text(error)
                            .font(HSFont.footnote)
                            .foregroundStyle(HSColor.danger)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .refreshable { await vm.load() }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private func categoryRow(_ display: CategoryDisplay, viewModel vm: CategoriesViewModel) -> some View {
        let defaultLabel = Categories.defaultLabel(for: display.value)
        let isCustom = display.label != defaultLabel
        let isEditing = editing == display.value
        let isSaving = vm.savingCategory == display.value

        HStack(spacing: HSSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                if isEditing {
                    TextField(defaultLabel, text: $draftLabel, onCommit: {
                        commitRename(display.value, vm: vm)
                    })
                    .font(HSFont.body)
                    .foregroundStyle(HSColor.dark)
                    .submitLabel(.done)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .padding(.vertical, 4)
                    .overlay(
                        Rectangle()
                            .frame(height: 1)
                            .foregroundStyle(HSColor.primary),
                        alignment: .bottom
                    )
                    .onSubmit { commitRename(display.value, vm: vm) }
                } else {
                    Button {
                        startRename(display.value, currentLabel: display.label)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(display.label)
                                .font(HSFont.body.weight(.semibold))
                                .foregroundStyle(HSColor.dark)
                            Text(isCustom ? "Default: \(defaultLabel)" : "Tap to rename")
                                .font(HSFont.footnote)
                                .foregroundStyle(HSColor.mid)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Rename \(display.label)")
                }
            }

            Spacer(minLength: HSSpacing.sm)

            if isCustom && !isEditing {
                Button("Reset") {
                    Task { await vm.setCustomLabel(display.value, label: nil) }
                }
                .font(HSFont.footnote.weight(.semibold))
                .foregroundStyle(HSColor.primary)
                .buttonStyle(.borderless)
                .disabled(isSaving)
            }

            if isSaving {
                ProgressView().controlSize(.small)
            } else {
                Toggle(
                    "",
                    isOn: Binding(
                        get: { !display.hidden },
                        set: { newValue in
                            Task { await vm.setHidden(display.value, hidden: !newValue) }
                        }
                    )
                )
                .labelsHidden()
                .accessibilityLabel("\(display.label) visible")
            }
        }
        .padding(.vertical, HSSpacing.xs)
    }

    private func startRename(_ category: ExpenseCategory, currentLabel: String) {
        editing = category
        draftLabel = currentLabel
    }

    private func commitRename(_ category: ExpenseCategory, vm: CategoriesViewModel) {
        let value = draftLabel
        editing = nil
        draftLabel = ""
        Task { await vm.setCustomLabel(category, label: value) }
    }

    private func refresh() async {
        guard let householdId = app.householdSession.membership?.householdId else {
            viewModel = nil
            return
        }
        if viewModel == nil || viewModel?.householdId != householdId {
            viewModel = CategoriesViewModel(
                householdId: householdId,
                repository: app.categoryPreferences
            )
        }
        await viewModel?.load()
    }
}

#Preview {
    NavigationStack {
        CategoriesView()
    }
}
