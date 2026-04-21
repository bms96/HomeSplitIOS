import Foundation

/// The three — and only three — gates that present the paywall.
///
/// Mirrors `components/PaywallGate.tsx` from the RN reference. No other
/// surface should show the paywall. If a new feature wants to gate, add
/// a case here and a matching copy entry.
enum PaywallTrigger: String, Hashable, Sendable, Identifiable {
    case thirdMember        = "third_member"
    case thirdRecurringBill = "third_recurring_bill"
    case moveOut            = "move_out"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .thirdMember:        return "Upgrade to add more roommates"
        case .thirdRecurringBill: return "Upgrade to add more recurring bills"
        case .moveOut:            return "Move-out is a Pro feature"
        }
    }

    var body: String {
        switch self {
        case .thirdMember:
            return "Homesplit Free supports up to 2 members. Upgrade to Pro for unlimited."
        case .thirdRecurringBill:
            return "Homesplit Free supports up to 2 recurring bills. Upgrade to Pro for unlimited."
        case .moveOut:
            return "The automated move-out flow handles settlement, proration, and member closeout. Upgrade to use it."
        }
    }
}
