import Foundation
import Observation

/// Backs the Categories screen: loads preferences, exposes a merged display
/// list, and pushes rename / visibility / reset writes through the repo.
@Observable
@MainActor
final class CategoriesViewModel {
    private(set) var prefs: [ExpenseCategoryPreference] = []
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?
    private(set) var savingCategory: ExpenseCategory?

    let householdId: UUID
    private let repository: any CategoryPreferencesRepositoryProtocol

    init(householdId: UUID, repository: any CategoryPreferencesRepositoryProtocol) {
        self.householdId = householdId
        self.repository = repository
    }

    var displays: [CategoryDisplay] {
        Categories.mergeDisplay(prefs)
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            prefs = try await repository.list(householdId: householdId)
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func setHidden(_ category: ExpenseCategory, hidden: Bool) async {
        let existing = prefs.first { $0.category == category }
        await upsert(
            category: category,
            hidden: hidden,
            customLabel: existing?.customLabel
        )
    }

    /// Save a custom label. Pass `nil` (or whitespace / the default label) to
    /// reset to default.
    func setCustomLabel(_ category: ExpenseCategory, label: String?) async {
        let existing = prefs.first { $0.category == category }
        let hidden = existing?.hidden ?? Categories.defaultHidden.contains(category)
        let trimmed = label?.trimmingCharacters(in: .whitespaces)
        let resolved: String?
        if let trimmed,
           !trimmed.isEmpty,
           trimmed != Categories.defaultLabel(for: category) {
            resolved = trimmed
        } else {
            resolved = nil
        }
        await upsert(category: category, hidden: hidden, customLabel: resolved)
    }

    private func upsert(
        category: ExpenseCategory,
        hidden: Bool,
        customLabel: String?
    ) async {
        savingCategory = category
        defer { savingCategory = nil }
        do {
            try await repository.upsert(
                householdId: householdId,
                category: category,
                hidden: hidden,
                customLabel: customLabel
            )
            await load()
        } catch {
            lastError = error.localizedDescription
        }
    }
}
