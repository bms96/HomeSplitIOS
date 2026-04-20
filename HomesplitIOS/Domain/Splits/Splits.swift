import Foundation

struct Split: Equatable, Hashable, Sendable {
    let memberId: String
    let amountOwed: Decimal
}

struct Share: Equatable, Hashable, Sendable {
    let memberId: String
    let value: Decimal
}

enum Splits {
    /// Equal-split calculator. First member absorbs the sub-cent rounding remainder
    /// so the returned splits always sum to exactly `amount`.
    static func calculateEqual(amount: Decimal, memberIds: [String]) -> [Split] {
        guard !memberIds.isEmpty else { return [] }
        let count = Decimal(memberIds.count)
        let base = (amount / count).flooredToCents()
        let remainder = (amount - base * count).roundedHalfAwayFromZero(scale: 2)
        return memberIds.enumerated().map { index, id in
            let owed = index == 0 ? (base + remainder).roundedHalfAwayFromZero(scale: 2) : base
            return Split(memberId: id, amountOwed: owed)
        }
    }

    /// Percentage-split calculator. Caller enforces the sum-to-100 invariant at the
    /// form boundary. First share absorbs the sub-cent rounding remainder so the
    /// returned splits sum to exactly `amount`.
    static func calculatePercent(amount: Decimal, shares: [Share]) -> [Split] {
        guard !shares.isEmpty else { return [] }
        let hundred = Decimal(100)
        let base = shares.map { share in
            (amount * share.value / hundred).flooredToCents()
        }
        let sum = base.reduce(Decimal(0), +)
        let remainder = (amount - sum).roundedHalfAwayFromZero(scale: 2)
        return shares.enumerated().map { index, share in
            let owed = index == 0
                ? (base[index] + remainder).roundedHalfAwayFromZero(scale: 2)
                : base[index]
            return Split(memberId: share.memberId, amountOwed: owed)
        }
    }

    /// Exact-amount split calculator. Trusts the caller's sum invariant and just
    /// normalizes each value to two decimals.
    static func calculateExact(shares: [Share]) -> [Split] {
        shares.map { share in
            Split(memberId: share.memberId, amountOwed: share.value.roundedHalfAwayFromZero(scale: 2))
        }
    }

    /// Sum of each share's `value`, rounded to two decimals.
    static func sumShares(_ shares: [Share]) -> Decimal {
        shares.reduce(Decimal(0)) { $0 + $1.value }.roundedHalfAwayFromZero(scale: 2)
    }
}
