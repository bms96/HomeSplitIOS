import Foundation

/// Recurring-bill cycle status helpers.
///
/// "Overdue" is not purely date-driven — if every included member has paid,
/// the bill is done, even if `next_due_date` hasn't been advanced yet (e.g.
/// the daily cron hasn't run). These predicates centralize the rule so the
/// home screen, bills list, and bill detail all agree.
enum BillStatus {
    /// True when every included member has recorded a payment for this cycle.
    /// Returns false for zero-included bills to avoid the vacuous-truth trap.
    static func isBillFullyPaid(paidCount: Int, includedCount: Int) -> Bool {
        if includedCount <= 0 { return false }
        return paidCount >= includedCount
    }

    /// True when the bill is past its due date AND at least one included
    /// member still hasn't paid. A fully-paid past-due bill is not "overdue" —
    /// it's done.
    static func isBillEffectivelyOverdue(
        daysUntilDue: Int,
        paidCount: Int,
        includedCount: Int
    ) -> Bool {
        if daysUntilDue >= 0 { return false }
        if includedCount <= 0 { return false }
        return paidCount < includedCount
    }
}
