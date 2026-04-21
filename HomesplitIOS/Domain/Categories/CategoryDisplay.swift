import Foundation

/// Pure domain helpers for projecting `ExpenseCategoryPreference` rows into
/// display labels and default-hidden state. Mirrors RN `useCategoryPreferences`.
/// No UI imports — safe to unit test on any platform.
struct CategoryDisplay: Equatable, Hashable, Sendable {
    let value: ExpenseCategory
    let label: String
    let hidden: Bool
}

enum Categories {
    /// Canonical display order. Matches RN `ALL_CATEGORIES`.
    static let allOrdered: [ExpenseCategory] = [
        .rent, .utilities, .groceries, .household, .food, .transport, .other
    ]

    static let defaultLabels: [ExpenseCategory: String] = [
        .rent:       "Rent",
        .utilities:  "Utilities",
        .groceries:  "Groceries",
        .household:  "Household",
        .food:       "Food",
        .transport:  "Transport",
        .other:      "Other"
    ]

    /// Categories hidden from the Add Expense picker by default — they belong
    /// to the recurring-bills flow. Users can surface them via Categories.
    static let defaultHidden: Set<ExpenseCategory> = [.rent, .utilities]

    static func defaultLabel(for category: ExpenseCategory) -> String {
        defaultLabels[category] ?? category.rawValue.capitalized
    }

    /// Merge stored preferences with defaults into an ordered display list.
    static func mergeDisplay(
        _ prefs: [ExpenseCategoryPreference]
    ) -> [CategoryDisplay] {
        let byCategory: [ExpenseCategory: ExpenseCategoryPreference] =
            Dictionary(uniqueKeysWithValues: prefs.map { ($0.category, $0) })
        return allOrdered.map { category in
            let pref = byCategory[category]
            let hidden = pref?.hidden ?? defaultHidden.contains(category)
            let custom = pref?.customLabel?.trimmingCharacters(in: .whitespaces)
            let label = (custom?.isEmpty == false ? custom! : defaultLabel(for: category))
            return CategoryDisplay(value: category, label: label, hidden: hidden)
        }
    }

    /// Resolve a single category's displayed label from preferences.
    static func label(
        for category: ExpenseCategory,
        in prefs: [ExpenseCategoryPreference]
    ) -> String {
        let pref = prefs.first { $0.category == category }
        let custom = pref?.customLabel?.trimmingCharacters(in: .whitespaces)
        if let custom, !custom.isEmpty { return custom }
        return defaultLabel(for: category)
    }
}
