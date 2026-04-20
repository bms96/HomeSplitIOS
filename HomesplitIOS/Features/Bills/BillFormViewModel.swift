import Foundation
import Observation

/// Drives `BillFormView` (add or edit). Equal-split only at MVP — the custom
/// percentage / exact-amount flows come with the detail screen's cycle
/// tooling. Seeded from an existing bill for edit; otherwise starts blank
/// with all active members included.
@Observable
@MainActor
final class BillFormViewModel {
    var name: String = ""
    /// Blank string encodes "variable amount". Parsing is shared with `parsedAmount`.
    var amountText: String = ""
    var frequency: BillFrequency = .monthly
    var nextDueDate: Date = Date()
    var active: Bool = true
    var includedMemberIds: Set<UUID> = []

    private(set) var isSubmitting: Bool = false
    private(set) var isDeleting: Bool = false
    private(set) var lastError: String?

    private let existingBillId: UUID?
    private let householdId: UUID
    let members: [Member]
    private let repository: any RecurringBillsRepositoryProtocol

    init(
        household: MembershipWithHousehold,
        members: [Member],
        existing: RecurringBill? = nil,
        repository: any RecurringBillsRepositoryProtocol
    ) {
        self.householdId = household.householdId
        self.members = members.filter(\.isActive)
        self.repository = repository
        if let bill = existing {
            self.existingBillId = bill.id
            self.name = bill.name
            self.amountText = bill.amount.map(Self.formatAmount) ?? ""
            self.frequency = bill.frequency
            self.nextDueDate = bill.nextDueDate
            self.active = bill.active
            let excluded = Set(bill.excludedMemberIds)
            self.includedMemberIds = Set(self.members.map(\.id).filter { !excluded.contains($0) })
        } else {
            self.existingBillId = nil
            self.includedMemberIds = Set(self.members.map(\.id))
        }
    }

    var isEditing: Bool { existingBillId != nil }

    var parsedAmount: Decimal? {
        let trimmed = amountText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        guard let value = Decimal(string: trimmed, locale: Locale.current) else { return nil }
        return value > 0 ? value : nil
    }

    var isVariableAmount: Bool {
        amountText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var canSubmit: Bool {
        guard !isSubmitting, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        if !isVariableAmount && parsedAmount == nil { return false }
        return !includedMemberIds.isEmpty
    }

    func toggleMember(_ id: UUID) {
        if includedMemberIds.contains(id) {
            includedMemberIds.remove(id)
        } else {
            includedMemberIds.insert(id)
        }
    }

    func submit() async -> Bool {
        guard canSubmit else { return false }
        isSubmitting = true
        lastError = nil
        defer { isSubmitting = false }

        let excluded = members.map(\.id).filter { !includedMemberIds.contains($0) }
        let input = SaveRecurringBillInput(
            id: existingBillId,
            householdId: householdId,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            amount: isVariableAmount ? nil : parsedAmount,
            frequency: frequency,
            nextDueDate: nextDueDate,
            active: active,
            splitType: .equal,
            excludedMemberIds: excluded,
            shares: []
        )
        do {
            _ = try await repository.save(input)
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func delete() async -> Bool {
        guard let id = existingBillId else { return false }
        isDeleting = true
        lastError = nil
        defer { isDeleting = false }
        do {
            try await repository.delete(id: id)
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    private static func formatAmount(_ amount: Decimal) -> String {
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
