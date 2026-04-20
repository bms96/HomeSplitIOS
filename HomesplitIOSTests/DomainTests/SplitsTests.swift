import Foundation
import Testing
@testable import Homesplit

private func d(_ s: String) -> Decimal { Decimal(string: s)! }
private func sum(_ splits: [Split]) -> Decimal {
    splits.reduce(Decimal(0)) { $0 + $1.amountOwed }
}

@Suite("calculateEqual")
struct CalculateEqualTests {
    @Test("returns empty array when there are no members")
    func empty() {
        #expect(Splits.calculateEqual(amount: 100, memberIds: []) == [])
    }

    @Test("assigns the full amount to a single member")
    func singleMember() {
        let result = Splits.calculateEqual(amount: 50, memberIds: ["A"])
        #expect(result == [Split(memberId: "A", amountOwed: 50)])
    }

    @Test("splits evenly between two members")
    func twoMembers() {
        let result = Splits.calculateEqual(amount: 100, memberIds: ["A", "B"])
        #expect(result[0].amountOwed == 50)
        #expect(result[1].amountOwed == 50)
    }

    @Test("assigns rounding remainder to first member")
    func remainderOnFirst() {
        let result = Splits.calculateEqual(amount: 10, memberIds: ["A", "B", "C"])
        #expect(result[0].amountOwed == d("3.34"))
        #expect(result[1].amountOwed == d("3.33"))
        #expect(result[2].amountOwed == d("3.33"))
    }

    @Test("splits always sum exactly to the expense total")
    func exactSumInvariant() {
        let cases: [(Decimal, Int)] = [
            (10, 3), (100, 3), (d("47.5"), 4), (d("0.03"), 2),
            (d("99.99"), 7), (1, 6), (d("33.33"), 3),
        ]
        for (amount, count) in cases {
            let members = (0..<count).map { "M\($0)" }
            let result = Splits.calculateEqual(amount: amount, memberIds: members)
            #expect(sum(result) == amount, "amount=\(amount) count=\(count) sum=\(sum(result))")
        }
    }

    @Test("handles $0 expense — every share is zero")
    func zeroExpense() {
        let result = Splits.calculateEqual(amount: 0, memberIds: ["A", "B", "C"])
        #expect(result.allSatisfy { $0.amountOwed == 0 })
    }

    @Test("preserves member order and ids")
    func preservesOrder() {
        let members = ["alice", "bob", "carol", "dave"]
        let result = Splits.calculateEqual(amount: 40, memberIds: members)
        #expect(result.map(\.memberId) == members)
    }

    @Test("first member share >= every other share (absorbs remainder)")
    func firstAbsorbsRemainder() {
        let result = Splits.calculateEqual(amount: 10, memberIds: ["A", "B", "C"])
        for i in 1..<result.count {
            #expect(result[0].amountOwed >= result[i].amountOwed)
        }
    }

    @Test("is deterministic — identical inputs produce identical output")
    func deterministic() {
        let ids = ["M0", "M1", "M2", "M3", "M4", "M5", "M6"]
        let a = Splits.calculateEqual(amount: d("100.07"), memberIds: ids)
        let b = Splits.calculateEqual(amount: d("100.07"), memberIds: ids)
        #expect(a == b)
    }

    @Test("handles negative amounts (refund) — sums exact, first absorbs remainder")
    func negativeAmounts() {
        let result = Splits.calculateEqual(amount: -10, memberIds: ["A", "B", "C"])
        #expect(sum(result) == -10)
        let base = result[1].amountOwed
        #expect(result[2].amountOwed == base)
        #expect(result[0].amountOwed != base)
    }

    @Test("handles tiny sub-cent refund (-$0.01 across 3) without losing the cent")
    func tinyRefund() {
        let result = Splits.calculateEqual(amount: d("-0.01"), memberIds: ["A", "B", "C"])
        #expect(sum(result) == d("-0.01"))
    }

    @Test("handles exact division with no remainder")
    func exactDivision() {
        let result = Splits.calculateEqual(amount: 99, memberIds: ["A", "B", "C"])
        #expect(result.allSatisfy { $0.amountOwed == 33 })
    }

    @Test("handles large household (10 members, awkward total)")
    func largeHousehold() {
        let members = (0..<10).map { "M\($0)" }
        let result = Splits.calculateEqual(amount: d("100.07"), memberIds: members)
        #expect(sum(result) == d("100.07"))
        #expect(result.count == 10)
    }
}

@Suite("calculatePercent")
struct CalculatePercentTests {
    @Test("returns empty array when there are no shares")
    func empty() {
        #expect(Splits.calculatePercent(amount: 100, shares: []) == [])
    }

    @Test("splits cleanly when percentages divide evenly")
    func evenDivide() {
        let result = Splits.calculatePercent(amount: 100, shares: [
            Share(memberId: "A", value: 50),
            Share(memberId: "B", value: 50),
        ])
        #expect(result == [
            Split(memberId: "A", amountOwed: 50),
            Split(memberId: "B", amountOwed: 50),
        ])
    }

    @Test("handles asymmetric percentages (60/30/10)")
    func asymmetric() {
        let result = Splits.calculatePercent(amount: 1000, shares: [
            Share(memberId: "A", value: 60),
            Share(memberId: "B", value: 30),
            Share(memberId: "C", value: 10),
        ])
        #expect(result == [
            Split(memberId: "A", amountOwed: 600),
            Split(memberId: "B", amountOwed: 300),
            Split(memberId: "C", amountOwed: 100),
        ])
    }

    @Test("absorbs sub-cent remainder on first share")
    func absorbsRemainder() {
        let result = Splits.calculatePercent(amount: 10, shares: [
            Share(memberId: "A", value: 33),
            Share(memberId: "B", value: 33),
            Share(memberId: "C", value: 34),
        ])
        #expect(sum(result) == 10)
    }

    @Test("splits always sum exactly to the bill amount")
    func exactSumInvariant() {
        let cases: [(Decimal, [Share])] = [
            (d("47.5"), [
                Share(memberId: "A", value: d("33.33")),
                Share(memberId: "B", value: d("33.33")),
                Share(memberId: "C", value: d("33.34")),
            ]),
            (d("99.99"), [
                Share(memberId: "A", value: 45),
                Share(memberId: "B", value: 35),
                Share(memberId: "C", value: 20),
            ]),
            (d("0.07"), [
                Share(memberId: "A", value: 50),
                Share(memberId: "B", value: 50),
            ]),
        ]
        for (amount, shares) in cases {
            #expect(sum(Splits.calculatePercent(amount: amount, shares: shares)) == amount)
        }
    }

    @Test("preserves member order and ids")
    func preservesOrder() {
        let shares = [
            Share(memberId: "alice", value: 25),
            Share(memberId: "bob",   value: 25),
            Share(memberId: "carol", value: 50),
        ]
        let result = Splits.calculatePercent(amount: 100, shares: shares)
        #expect(result.map(\.memberId) == ["alice", "bob", "carol"])
    }

    @Test("handles $0 bill — every share is zero")
    func zeroBill() {
        let result = Splits.calculatePercent(amount: 0, shares: [
            Share(memberId: "A", value: 60),
            Share(memberId: "B", value: 40),
        ])
        #expect(result.allSatisfy { $0.amountOwed == 0 })
    }

    @Test("handles 100% assigned to a single member")
    func fullToOne() {
        let result = Splits.calculatePercent(amount: 250, shares: [
            Share(memberId: "A", value: 100),
        ])
        #expect(result == [Split(memberId: "A", amountOwed: 250)])
    }
}

@Suite("calculateExact")
struct CalculateExactTests {
    @Test("returns empty array when there are no shares")
    func empty() {
        #expect(Splits.calculateExact(shares: []) == [])
    }

    @Test("passes through exact amounts (caller already validated sum)")
    func passthrough() {
        let result = Splits.calculateExact(shares: [
            Share(memberId: "A", value: 40),
            Share(memberId: "B", value: d("12.5")),
        ])
        #expect(result == [
            Split(memberId: "A", amountOwed: 40),
            Split(memberId: "B", amountOwed: d("12.5")),
        ])
    }

    @Test("preserves member order and ids")
    func preservesOrder() {
        let result = Splits.calculateExact(shares: [
            Share(memberId: "z", value: 1),
            Share(memberId: "a", value: 2),
            Share(memberId: "m", value: 3),
        ])
        #expect(result.map(\.memberId) == ["z", "a", "m"])
    }

    @Test("handles zero-valued members (included but owes nothing)")
    func zeroMember() {
        let result = Splits.calculateExact(shares: [
            Share(memberId: "A", value: 100),
            Share(memberId: "B", value: 0),
        ])
        #expect(result[1].amountOwed == 0)
    }
}

@Suite("sumShares")
struct SumSharesTests {
    @Test("returns 0 for an empty array")
    func empty() {
        #expect(Splits.sumShares([]) == 0)
    }

    @Test("sums integer values")
    func integers() {
        let total = Splits.sumShares([
            Share(memberId: "A", value: 60),
            Share(memberId: "B", value: 40),
        ])
        #expect(total == 100)
    }

    @Test("sums fractional percentages exactly (33.33 + 33.33 + 33.34 = 100)")
    func fractional() {
        let total = Splits.sumShares([
            Share(memberId: "A", value: d("33.33")),
            Share(memberId: "B", value: d("33.33")),
            Share(memberId: "C", value: d("33.34")),
        ])
        #expect(total == 100)
    }
}
