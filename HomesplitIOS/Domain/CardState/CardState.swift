import Foundation

/// Stat-card state machine for the home dashboard.
///
/// Each card has three tones driving background color:
///   positive (green) — nothing to worry about
///   caution  (yellow) — attention this cycle, nothing urgent
///   alert    (red)    — overdue or carrying over from last cycle
///
/// Text is paired so the card reads correctly for color-blind users and
/// screen readers without relying on color alone.
enum CardTone: String, Hashable, Sendable {
    case positive
    case caution
    case alert
}

struct StatCardState: Hashable, Sendable {
    let tone: CardTone
    let text: String
}

enum CardState {
    /// "You owe" card.
    /// - positive: 0 current-cycle expenses and nothing carrying over.
    /// - caution:  owe something this cycle, no carryover.
    /// - alert:    carrying over unsettled debt from a prior cycle.
    static func computeYouOwe(count: Int, hasCarryover: Bool) -> StatCardState {
        if hasCarryover { return StatCardState(tone: .alert, text: "Unpaid from last cycle") }
        if count == 0 { return StatCardState(tone: .positive, text: "All settled up") }
        return StatCardState(tone: .caution, text: "Due this cycle")
    }

    /// "Owed to you" card.
    /// - positive: 0 unpaid this cycle and nothing lingering from before.
    /// - caution:  roommates owe you this cycle, no carryover.
    /// - alert:    roommates owe you from a prior cycle.
    static func computeOwedToYou(count: Int, hasCarryover: Bool) -> StatCardState {
        if hasCarryover { return StatCardState(tone: .alert, text: "Unpaid from last cycle") }
        if count == 0 { return StatCardState(tone: .positive, text: "Fully reimbursed") }
        return StatCardState(tone: .caution, text: "Waiting on roommates")
    }

    /// "Bills due" card.
    /// - positive: no bills due in window and none overdue.
    /// - caution:  bills due in window, none overdue.
    /// - alert:    at least one bill past its due date.
    static func computeBillsDue(count: Int, hasOverdue: Bool) -> StatCardState {
        if hasOverdue { return StatCardState(tone: .alert, text: "Past due") }
        if count == 0 { return StatCardState(tone: .positive, text: "All caught up") }
        return StatCardState(tone: .caution, text: "Coming up")
    }
}
