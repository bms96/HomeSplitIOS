import Foundation
import Testing
@testable import Homesplit

private func d(_ s: String) -> Decimal { Decimal(string: s)! }
private func sumAmounts(_ debts: [Debt]) -> Decimal {
    debts.reduce(Decimal(0)) { $0 + $1.amount }
}
private func netFromDebts(_ debts: [Debt]) -> [String: Decimal] {
    var net: [String: Decimal] = [:]
    for d in debts {
        net[d.from, default: 0] -= d.amount
        net[d.to,   default: 0] += d.amount
    }
    return net
}
private func approxEqual(_ a: Decimal, _ b: Decimal, tolerance: Decimal = d("0.01")) -> Bool {
    let diff = a - b
    return (diff < 0 ? -diff : diff) <= tolerance
}

@Suite("Debts.simplify")
struct SimplifyDebtsTests {
    @Test("returns empty array for empty input")
    func empty() {
        #expect(Debts.simplify([]) == [])
    }

    @Test("passes through a single two-person debt unchanged")
    func single() {
        let result = Debts.simplify([Debt(from: "A", to: "B", amount: 50)])
        #expect(result == [Debt(from: "A", to: "B", amount: 50)])
    }

    @Test("nets mutual debts to the difference in the correct direction")
    func mutual() {
        let result = Debts.simplify([
            Debt(from: "A", to: "B", amount: 30),
            Debt(from: "B", to: "A", amount: 20),
        ])
        #expect(result.count == 1)
        #expect(result[0].from == "A")
        #expect(result[0].to == "B")
        #expect(result[0].amount == 10)
    }

    @Test("returns empty array when all debts cancel out exactly")
    func cancel() {
        let result = Debts.simplify([
            Debt(from: "A", to: "B", amount: 25),
            Debt(from: "B", to: "A", amount: 25),
        ])
        #expect(result == [])
    }

    @Test("collapses a three-person chain A→B→C into A→C")
    func chain() {
        let result = Debts.simplify([
            Debt(from: "A", to: "B", amount: 50),
            Debt(from: "B", to: "C", amount: 50),
        ])
        #expect(result.count == 1)
        #expect(result[0].from == "A")
        #expect(result[0].to == "C")
        #expect(result[0].amount == 50)
    }

    @Test("preserves aggregate balance across transformations")
    func preservesBalance() {
        let debts = [
            Debt(from: "A", to: "B", amount: 40),
            Debt(from: "C", to: "B", amount: 20),
            Debt(from: "A", to: "D", amount: 10),
        ]
        let result = Debts.simplify(debts)
        let before = netFromDebts(debts)
        let after = netFromDebts(result)
        for m in before.keys {
            #expect(approxEqual(after[m] ?? 0, before[m] ?? 0))
        }
    }

    @Test("never produces more transactions than N-1 for N members")
    func atMostNMinus1() {
        let debts = [
            Debt(from: "A", to: "B", amount: 40),
            Debt(from: "C", to: "B", amount: 20),
            Debt(from: "A", to: "D", amount: 10),
            Debt(from: "D", to: "C", amount: 5),
        ]
        let result = Debts.simplify(debts)
        var members: Set<String> = []
        for d in debts { members.insert(d.from); members.insert(d.to) }
        #expect(result.count <= members.count - 1)
    }

    @Test("pairs largest debtor with largest creditor (greedy invariant)")
    func greedy() {
        let result = Debts.simplify([
            Debt(from: "A", to: "C", amount: 100),
            Debt(from: "B", to: "C", amount: 10),
        ])
        let fromA = result.first { $0.from == "A" && $0.to == "C" }
        #expect(fromA?.amount == 100)
    }

    @Test("suppresses debts below the 1¢ threshold")
    func subCent() {
        let result = Debts.simplify([Debt(from: "A", to: "B", amount: d("0.005"))])
        #expect(result == [])
    }

    @Test("never emits a self-loop (from === to)")
    func noSelfLoop() {
        let result = Debts.simplify([
            Debt(from: "A", to: "B", amount: 50),
            Debt(from: "B", to: "A", amount: 30),
            Debt(from: "A", to: "C", amount: 40),
        ])
        for edge in result { #expect(edge.from != edge.to) }
    }

    @Test("emits only positive amounts")
    func positiveAmounts() {
        let result = Debts.simplify([
            Debt(from: "A", to: "B", amount: 25),
            Debt(from: "C", to: "D", amount: 15),
            Debt(from: "B", to: "A", amount: 5),
        ])
        for edge in result { #expect(edge.amount > 0) }
    }

    @Test("does not mutate the input array")
    func doesNotMutate() {
        let debts = [
            Debt(from: "A", to: "B", amount: 30),
            Debt(from: "B", to: "A", amount: 20),
        ]
        let snapshot = debts
        _ = Debts.simplify(debts)
        #expect(debts == snapshot)
    }

    @Test("handles large households (six members, many debts)")
    func largeHousehold() {
        let debts = [
            Debt(from: "A", to: "B", amount: 100),
            Debt(from: "A", to: "C", amount: 50),
            Debt(from: "B", to: "D", amount: 75),
            Debt(from: "C", to: "E", amount: 40),
            Debt(from: "D", to: "F", amount: 20),
            Debt(from: "E", to: "A", amount: 30),
            Debt(from: "F", to: "B", amount: 10),
        ]
        let result = Debts.simplify(debts)
        let before = netFromDebts(debts)
        let after = netFromDebts(result)
        for m in ["A", "B", "C", "D", "E", "F"] {
            #expect(approxEqual(after[m] ?? 0, before[m] ?? 0))
        }
        #expect(result.count <= 5)
    }

    @Test("total amount moved equals sum of creditor balances")
    func totalMoved() {
        let debts = [
            Debt(from: "A", to: "B", amount: 40),
            Debt(from: "C", to: "B", amount: 20),
            Debt(from: "A", to: "D", amount: 10),
        ]
        let result = Debts.simplify(debts)
        let net = netFromDebts(debts)
        let totalOwed = net.values.filter { $0 > 0 }.reduce(Decimal(0), +)
        #expect(approxEqual(sumAmounts(result), totalOwed))
    }
}

@Suite("Debts.computePairwise")
struct ComputePairwiseDebtsTests {
    @Test("returns empty array for empty input")
    func empty() {
        #expect(Debts.computePairwise([]) == [])
    }

    @Test("passes through a single debt unchanged")
    func single() {
        #expect(Debts.computePairwise([Debt(from: "A", to: "B", amount: 50)])
                == [Debt(from: "A", to: "B", amount: 50)])
    }

    @Test("nets mutual debts between a pair to the residual direction")
    func mutual() {
        let result = Debts.computePairwise([
            Debt(from: "A", to: "B", amount: 30),
            Debt(from: "B", to: "A", amount: 20),
        ])
        #expect(result == [Debt(from: "A", to: "B", amount: 10)])
    }

    @Test("drops pairs that fully cancel out")
    func cancel() {
        let result = Debts.computePairwise([
            Debt(from: "A", to: "B", amount: 25),
            Debt(from: "B", to: "A", amount: 25),
        ])
        #expect(result == [])
    }

    @Test("never chains across members (A→B, B→C stays two edges)")
    func noChain() {
        let result = Debts.computePairwise([
            Debt(from: "A", to: "B", amount: 50),
            Debt(from: "B", to: "C", amount: 50),
        ])
        #expect(result.count == 2)
        let pairs = Set(result.map { [$0.from, $0.to].sorted().joined(separator: "|") })
        #expect(pairs == ["A|B", "B|C"])
    }

    @Test("aggregates multiple debts within the same pair")
    func aggregates() {
        let result = Debts.computePairwise([
            Debt(from: "A", to: "B", amount: 10),
            Debt(from: "A", to: "B", amount: 15),
            Debt(from: "B", to: "A", amount: 5),
        ])
        #expect(result == [Debt(from: "A", to: "B", amount: 20)])
    }

    @Test("preserves each pair independently with multiple members")
    func preservesPairs() {
        let result = Debts.computePairwise([
            Debt(from: "A", to: "B", amount: 40),
            Debt(from: "C", to: "B", amount: 20),
            Debt(from: "A", to: "D", amount: 10),
        ])
        #expect(result.count == 3)
        let findAmount: (String, String) -> Decimal? = { from, to in
            result.first { $0.from == from && $0.to == to }?.amount
        }
        #expect(findAmount("A", "B") == 40)
        #expect(findAmount("C", "B") == 20)
        #expect(findAmount("A", "D") == 10)
    }

    @Test("suppresses sub-cent residuals below the 1¢ threshold")
    func subCent() {
        let result = Debts.computePairwise([
            Debt(from: "A", to: "B", amount: 10),
            Debt(from: "B", to: "A", amount: d("9.999")),
        ])
        #expect(result == [])
    }

    @Test("rounds each emitted amount to two decimals")
    func rounds() {
        let result = Debts.computePairwise([
            Debt(from: "A", to: "B", amount: d("10.005")),
        ])
        #expect(result[0].amount == d("10.01"))
    }

    @Test("does not mutate the input array")
    func doesNotMutate() {
        let debts = [
            Debt(from: "A", to: "B", amount: 30),
            Debt(from: "B", to: "A", amount: 20),
        ]
        let snapshot = debts
        _ = Debts.computePairwise(debts)
        #expect(debts == snapshot)
    }
}

@Suite("Debts.computeNetBalances")
struct ComputeNetBalancesTests {
    @Test("returns empty array when there are no splits")
    func empty() {
        #expect(Debts.computeNetBalances([]) == [])
    }

    @Test("ignores splits where member owes themselves")
    func selfOwing() {
        let result = Debts.computeNetBalances([
            SplitRow(memberId: "A", amountOwed: 25, paidByMemberId: "A"),
        ])
        #expect(result == [])
    }

    @Test("excludes payer self-split from net balances (three-way equal split)")
    func threeWayEqual() {
        let result = Debts.computeNetBalances([
            SplitRow(memberId: "A", amountOwed: 20, paidByMemberId: "A"),
            SplitRow(memberId: "B", amountOwed: 20, paidByMemberId: "A"),
            SplitRow(memberId: "C", amountOwed: 20, paidByMemberId: "A"),
        ])
        let byMember = Dictionary(uniqueKeysWithValues: result.map { ($0.memberId, $0.net) })
        #expect(byMember["A"] == 40)
        #expect(byMember["B"] == -20)
        #expect(byMember["C"] == -20)
        let total = result.reduce(Decimal(0)) { $0 + $1.net }
        #expect(total == 0)
    }

    @Test("excludes payer self-split when payer is also a debtor on another expense")
    func payerAlsoDebtor() {
        let result = Debts.computeNetBalances([
            SplitRow(memberId: "A", amountOwed: 30, paidByMemberId: "A"),
            SplitRow(memberId: "B", amountOwed: 30, paidByMemberId: "A"),
            SplitRow(memberId: "A", amountOwed: 15, paidByMemberId: "B"),
            SplitRow(memberId: "B", amountOwed: 15, paidByMemberId: "B"),
        ])
        let byMember = Dictionary(uniqueKeysWithValues: result.map { ($0.memberId, $0.net) })
        #expect(byMember["A"] == 15)
        #expect(byMember["B"] == -15)
    }

    @Test("credits the payer and debits the owing member")
    func creditsPayer() {
        let result = Debts.computeNetBalances([
            SplitRow(memberId: "B", amountOwed: 30, paidByMemberId: "A"),
        ])
        let byMember = Dictionary(uniqueKeysWithValues: result.map { ($0.memberId, $0.net) })
        #expect(byMember["A"] == 30)
        #expect(byMember["B"] == -30)
    }

    @Test("aggregates across multiple splits for the same members")
    func aggregates() {
        let result = Debts.computeNetBalances([
            SplitRow(memberId: "B", amountOwed: 10, paidByMemberId: "A"),
            SplitRow(memberId: "B", amountOwed: 15, paidByMemberId: "A"),
            SplitRow(memberId: "A", amountOwed:  5, paidByMemberId: "B"),
        ])
        let byMember = Dictionary(uniqueKeysWithValues: result.map { ($0.memberId, $0.net) })
        #expect(byMember["A"] == 20)
        #expect(byMember["B"] == -20)
    }

    @Test("net balances sum to zero (conservation of money)")
    func conservation() {
        let result = Debts.computeNetBalances([
            SplitRow(memberId: "B", amountOwed: d("12.34"), paidByMemberId: "A"),
            SplitRow(memberId: "C", amountOwed: d("7.66"),  paidByMemberId: "A"),
            SplitRow(memberId: "A", amountOwed: d("3.5"),   paidByMemberId: "C"),
        ])
        let total = result.reduce(Decimal(0)) { $0 + $1.net }
        #expect(total == 0)
    }
}
