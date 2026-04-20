import Foundation
import Testing
@testable import Homesplit

@Suite("buildInviteUrl")
struct BuildInviteUrlTests {
    @Test("builds a universal https link with the invite token")
    func universal() {
        #expect(Deeplinks.buildInviteUrl(token: "abc123") == "https://homesplit.app/join/abc123")
    }
}

@Suite("buildInviteDeepLink")
struct BuildInviteDeepLinkTests {
    @Test("builds a custom-scheme deep link with the invite token")
    func customScheme() {
        #expect(Deeplinks.buildInviteDeepLink(token: "abc123") == "homesplit://join/abc123")
    }
}

@Suite("buildVenmoUrl")
struct BuildVenmoUrlTests {
    @Test("formats amount to two decimals")
    func twoDecimals() {
        let url = Deeplinks.buildVenmoUrl(amount: 42, note: "rent", recipient: "alice")
        #expect(url.contains("amount=42.00"))
    }

    @Test("URL-encodes the note")
    func encodesNote() {
        let url = Deeplinks.buildVenmoUrl(amount: 10, note: "May rent & utilities")
        #expect(url.contains("note=May%20rent%20%26%20utilities"))
    }

    @Test("URL-encodes the recipient username")
    func encodesRecipient() {
        let url = Deeplinks.buildVenmoUrl(amount: 10, note: "n", recipient: "user name")
        #expect(url.contains("recipients=user%20name"))
    }

    @Test("omits recipient query when not provided")
    func noRecipient() {
        let url = Deeplinks.buildVenmoUrl(amount: 10, note: "n")
        #expect(!url.contains("recipients="))
        #expect(url.hasPrefix("venmo://paycharge?txn=pay&amount="))
    }

    @Test("rounds fractional cents in the amount")
    func rounding() {
        let url = Deeplinks.buildVenmoUrl(amount: Decimal(string: "12.345")!, note: "n")
        #expect(url.contains("amount=12.35"))
    }

    @Test("URL-encodes unicode characters and survives a decode roundtrip")
    func unicode() {
        let note = "May's rent 🏠"
        let url = Deeplinks.buildVenmoUrl(amount: 10, note: note)
        #expect(!url.contains("🏠"))
        #expect(url.contains("note="))
        let parts = url.components(separatedBy: "note=")
        #expect(parts.count == 2)
        let decoded = parts[1].removingPercentEncoding
        #expect(decoded == note)
    }

    @Test("formats a $0.00 amount")
    func zero() {
        let url = Deeplinks.buildVenmoUrl(amount: 0, note: "settled")
        #expect(url.contains("amount=0.00"))
    }
}

@Suite("buildCashAppUrl")
struct BuildCashAppUrlTests {
    @Test("builds a URL with cashtag and amount formatted to two decimals")
    func withCashtag() {
        let url = Deeplinks.buildCashAppUrl(amount: 25, cashtag: "alice")
        #expect(url == "https://cash.app/$alice/25.00")
    }

    @Test("URL-encodes the cashtag")
    func encodesCashtag() {
        let url = Deeplinks.buildCashAppUrl(amount: 1, cashtag: "a b")
        #expect(url == "https://cash.app/$a%20b/1.00")
    }

    @Test("falls back to the Cash App home page when no cashtag is provided")
    func fallback() {
        let url = Deeplinks.buildCashAppUrl(amount: 25)
        #expect(url == "https://cash.app")
    }
}
