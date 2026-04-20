import Foundation

enum Money {
    static let usdFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.locale = Locale(identifier: "en_US")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    static func formatUSD(_ amount: Decimal) -> String {
        let rounded = amount.roundedHalfAwayFromZero(scale: 2)
        return usdFormatter.string(from: rounded as NSDecimalNumber) ?? ""
    }

    static func parseUSD(_ input: String, locale: Locale = .current) -> Decimal? {
        let trimmed = input
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return Decimal(string: trimmed, locale: locale)
    }
}
