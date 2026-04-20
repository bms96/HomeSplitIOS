import Foundation

enum Deeplinks {
    /// Universal link — opens the app if installed, falls back to the web site otherwise.
    /// Prefer this for shareable links that reach people who might not have the app yet.
    static func buildInviteUrl(token: String) -> String {
        "https://homesplit.app/join/\(token)"
    }

    /// Custom-scheme deep link — only resolves inside the app.
    /// Use for in-app navigation when the app is confirmed open.
    static func buildInviteDeepLink(token: String) -> String {
        "homesplit://join/\(token)"
    }

    /// Venmo payment request. Opens the Venmo app if installed.
    /// `recipient` is the Venmo username (without the leading @).
    static func buildVenmoUrl(
        amount: Decimal,
        note: String,
        recipient: String? = nil
    ) -> String {
        let base: String
        if let recipient = recipient {
            base = "venmo://paycharge?txn=pay&recipients=\(percentEncode(recipient))"
        } else {
            base = "venmo://paycharge?txn=pay"
        }
        return "\(base)&amount=\(formatAmount(amount))&note=\(percentEncode(note))"
    }

    /// Cash App payment link. Opens Cash App if installed, falls back to the web page.
    /// `cashtag` is the $username (without the leading $).
    static func buildCashAppUrl(amount: Decimal, cashtag: String? = nil) -> String {
        guard let cashtag = cashtag else { return "https://cash.app" }
        return "https://cash.app/$\(percentEncode(cashtag))/\(formatAmount(amount))"
    }

    // MARK: - Helpers

    /// Match JS `Number.prototype.toFixed(2)`: round half-away-from-zero to 2 decimals.
    private static func formatAmount(_ amount: Decimal) -> String {
        let rounded = amount.roundedHalfAwayFromZero(scale: 2)
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.usesGroupingSeparator = false
        formatter.decimalSeparator = "."
        return formatter.string(from: rounded as NSDecimalNumber) ?? "0.00"
    }

    /// Mirror JS `encodeURIComponent` — encode everything except the RFC 3986
    /// unreserved set (A-Z a-z 0-9 - _ . ~) plus `!*'()`.
    private static func percentEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: encodeURIComponentAllowed) ?? value
    }

    private static let encodeURIComponentAllowed: CharacterSet = {
        var set = CharacterSet()
        set.insert(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~!*'()")
        return set
    }()
}
