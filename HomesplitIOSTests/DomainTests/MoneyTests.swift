import Foundation
import Testing
@testable import Homesplit

@Suite("formatUSD")
struct FormatUSDTests {
    @Test("formats whole dollars with two decimals and a $ sign")
    func wholeDollars() {
        #expect(Money.formatUSD(Decimal(string: "47")!) == "$47.00")
    }

    @Test("rounds to two decimals")
    func roundsToTwo() {
        #expect(Money.formatUSD(Decimal(string: "12.345")!) == "$12.35")
    }

    @Test("inserts thousands separators")
    func thousandsSeparators() {
        #expect(Money.formatUSD(Decimal(string: "1234567.89")!) == "$1,234,567.89")
    }

    @Test("formats zero")
    func zero() {
        #expect(Money.formatUSD(0) == "$0.00")
    }

    @Test("formats negative amounts with a leading minus")
    func negative() {
        #expect(Money.formatUSD(Decimal(string: "-42.5")!) == "-$42.50")
    }

    @Test("pads sub-cent fractions up to two decimals")
    func padsFractions() {
        #expect(Money.formatUSD(Decimal(string: "3.1")!) == "$3.10")
    }

    @Test("formats large negative amounts with thousands separators")
    func largeNegative() {
        #expect(Money.formatUSD(Decimal(string: "-1234567.89")!) == "-$1,234,567.89")
    }
}

@Suite("parseUSD")
struct ParseUSDTests {
    @Test("parses a plain decimal string")
    func plain() {
        #expect(Money.parseUSD("42.50") == Decimal(string: "42.50"))
    }

    @Test("strips a leading dollar sign")
    func stripsDollar() {
        #expect(Money.parseUSD("$42.50") == Decimal(string: "42.50"))
    }

    @Test("strips thousands separators")
    func stripsCommas() {
        #expect(Money.parseUSD("1,234.56") == Decimal(string: "1234.56"))
    }

    @Test("returns nil for empty input")
    func empty() {
        #expect(Money.parseUSD("") == nil)
    }

    @Test("returns nil for non-numeric input")
    func nonNumeric() {
        #expect(Money.parseUSD("abc") == nil)
    }
}
