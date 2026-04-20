import Foundation

struct Debt: Equatable, Hashable, Sendable {
    let from: String
    let to: String
    let amount: Decimal
}

struct MemberNetBalance: Equatable, Hashable, Sendable {
    let memberId: String
    let net: Decimal
}

struct SplitRow: Equatable, Hashable, Sendable {
    let memberId: String
    let amountOwed: Decimal
    let paidByMemberId: String
}

enum Debts {
    private static let threshold = Decimal(string: "0.01")!

    /// Greedy debt simplification. Reduces "A owes B X" entries to the minimum set of
    /// transactions that settles every member's net balance. Each member's balance is
    /// computed (positive = owed money, negative = owes money), then the largest
    /// creditor is paid by the largest debtor iteratively.
    static func simplify(_ debts: [Debt]) -> [Debt] {
        var balance: [String: Decimal] = [:]
        for d in debts {
            balance[d.from, default: 0] -= d.amount
            balance[d.to,   default: 0] += d.amount
        }

        var creditors = balance
            .filter { $0.value > threshold }
            .sorted { $0.value > $1.value }
            .map { (id: $0.key, bal: $0.value) }
        var debtors = balance
            .filter { $0.value < -threshold }
            .sorted { $0.value < $1.value }
            .map { (id: $0.key, bal: $0.value) }

        var result: [Debt] = []
        var ci = 0
        var di = 0
        while ci < creditors.count && di < debtors.count {
            let creditorBal = creditors[ci].bal
            let debtorBal = debtors[di].bal
            let cap = min(creditorBal, -debtorBal)
            let settled = cap.roundedHalfAwayFromZero(scale: 2)
            if settled > 0 {
                result.append(Debt(
                    from: debtors[di].id,
                    to: creditors[ci].id,
                    amount: settled
                ))
            }
            creditors[ci].bal -= settled
            debtors[di].bal += settled
            if creditors[ci].bal < threshold { ci += 1 }
            if debtors[di].bal > -threshold  { di += 1 }
        }
        return result
    }

    /// Nets each unordered pair of members to a single debt. Unlike `simplify`, this
    /// never routes through intermediaries — every returned edge corresponds to real
    /// expense_splits between those two members.
    static func computePairwise(_ debts: [Debt]) -> [Debt] {
        var pair: [String: Decimal] = [:]
        var dir: [String: (String, String)] = [:]
        var order: [String] = []
        for d in debts {
            let (a, b) = d.from < d.to ? (d.from, d.to) : (d.to, d.from)
            let key = "\(a)|\(b)"
            let signed = d.from == a ? d.amount : -d.amount
            if pair[key] == nil { order.append(key) }
            pair[key, default: 0] += signed
            dir[key] = (a, b)
        }
        var result: [Debt] = []
        for key in order {
            guard let net = pair[key], let (a, b) = dir[key] else { continue }
            let absValue = (net < 0 ? -net : net).roundedHalfAwayFromZero(scale: 2)
            if absValue < threshold { continue }
            result.append(net > 0
                ? Debt(from: a, to: b, amount: absValue)
                : Debt(from: b, to: a, amount: absValue))
        }
        return result
    }

    /// Computes each member's net balance from unsettled splits.
    /// net > 0 → owed money; net < 0 → owes money. Payer self-splits are skipped.
    static func computeNetBalances(_ splits: [SplitRow]) -> [MemberNetBalance] {
        var balance: [String: Decimal] = [:]
        var order: [String] = []
        func bump(_ id: String, _ delta: Decimal) {
            if balance[id] == nil { order.append(id) }
            balance[id, default: 0] += delta
        }
        for s in splits {
            if s.memberId == s.paidByMemberId { continue }
            bump(s.paidByMemberId, s.amountOwed)
            bump(s.memberId, -s.amountOwed)
        }
        return order.map { id in
            MemberNetBalance(
                memberId: id,
                net: (balance[id] ?? 0).roundedHalfAwayFromZero(scale: 2)
            )
        }
    }
}
