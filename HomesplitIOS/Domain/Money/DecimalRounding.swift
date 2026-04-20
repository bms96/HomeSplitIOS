import Foundation

extension Decimal {
    func rounded(scale: Int, mode: NSDecimalNumber.RoundingMode) -> Decimal {
        var result = Decimal()
        var value = self
        NSDecimalRound(&result, &value, scale, mode)
        return result
    }

    func roundedHalfAwayFromZero(scale: Int = 2) -> Decimal {
        rounded(scale: scale, mode: .plain)
    }

    func truncated(toScale scale: Int) -> Decimal {
        rounded(scale: scale, mode: .down)
    }

    func flooredToCents() -> Decimal {
        let truncated = self.truncated(toScale: 2)
        if self < truncated {
            return truncated - Decimal(sign: .plus, exponent: -2, significand: 1)
        }
        return truncated
    }
}
