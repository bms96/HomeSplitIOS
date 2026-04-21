import Foundation
import Observation

@Observable
@MainActor
final class MoveOutFlowViewModel {
    enum Step: Equatable {
        case pick
        case review
        case done(summary: DoneSummary)
    }

    struct DoneSummary: Equatable {
        let moveOut: MoveOut
        let departingName: String
        let localPDFURL: URL?
        let remotePDFURL: String?
    }

    private(set) var step: Step = .pick
    private(set) var members: [Member] = []
    private(set) var cycle: BillingCycle?
    private(set) var isLoading: Bool = false
    private(set) var isFinalizing: Bool = false
    private(set) var lastError: String?

    var selectedMemberId: UUID?
    var moveOutDate: Date = MoveOutFlowViewModel.todayAtMidnight()
    var dateError: String?

    let household: MembershipWithHousehold
    private let householdsRepo: any HouseholdRepositoryProtocol
    private let expensesRepo: any ExpensesRepositoryProtocol
    private let moveOutsRepo: any MoveOutRepositoryProtocol

    init(
        household: MembershipWithHousehold,
        householdsRepo: any HouseholdRepositoryProtocol,
        expensesRepo: any ExpensesRepositoryProtocol,
        moveOutsRepo: any MoveOutRepositoryProtocol
    ) {
        self.household = household
        self.householdsRepo = householdsRepo
        self.expensesRepo = expensesRepo
        self.moveOutsRepo = moveOutsRepo
        self.selectedMemberId = household.id
    }

    var selectedMember: Member? {
        guard let id = selectedMemberId else { return nil }
        return members.first { $0.id == id }
    }

    var cycleStartIso: String? { cycle.map { Self.iso($0.startDate) } }
    var cycleEndIso: String? { cycle.map { Self.iso($0.endDate) } }
    var moveOutIso: String { Self.iso(moveOutDate) }

    var daysPresent: Int? {
        guard let start = cycleStartIso, let end = cycleEndIso else { return nil }
        return Proration.daysPresent(
            cycleStartIso: start,
            cycleEndIso: end,
            moveOutIso: moveOutIso
        )
    }

    var cycleTotalDays: Int? {
        guard let start = cycleStartIso, let end = cycleEndIso else { return nil }
        return Proration.cycleTotalDays(cycleStartIso: start, cycleEndIso: end)
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let members = householdsRepo.members(householdId: household.householdId)
            async let cycle = expensesRepo.currentCycle(householdId: household.householdId)
            self.members = try await members
            self.cycle = try await cycle
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func goToReview() {
        dateError = nil
        lastError = nil
        guard selectedMemberId != nil else {
            lastError = "Pick who is moving out."
            return
        }
        if let start = cycle?.startDate, moveOutDate < start {
            dateError = "Must be on or after the cycle start."
            return
        }
        step = .review
    }

    func goBackToPick() {
        step = .pick
    }

    func confirm() async {
        guard let memberId = selectedMemberId,
              let member = selectedMember else { return }
        isFinalizing = true
        lastError = nil
        defer { isFinalizing = false }

        do {
            let moveOutId = try await moveOutsRepo.complete(
                householdId: household.householdId,
                memberId: memberId,
                moveOutDateIso: moveOutIso
            )
            let moveOut = try await moveOutsRepo.fetch(id: moveOutId)

            var localURL: URL?
            var remoteURL: String?
            do {
                let url = try MoveOutPDF.render(
                    MoveOutPDF.Input(
                        household: household.household,
                        departingMember: member,
                        moveOut: moveOut,
                        activeMembers: members
                    )
                )
                localURL = url
                remoteURL = try? await moveOutsRepo.uploadPdf(
                    moveOutId: moveOutId,
                    householdId: household.householdId,
                    fileURL: url
                )
            } catch {
                // PDF is a best-effort artifact — don't block move-out completion.
            }

            step = .done(summary: DoneSummary(
                moveOut: moveOut,
                departingName: member.displayName,
                localPDFURL: localURL,
                remotePDFURL: remoteURL
            ))
        } catch {
            lastError = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private static func todayAtMidnight() -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let comps = cal.dateComponents([.year, .month, .day], from: Date())
        return cal.date(from: comps) ?? Date()
    }

    private static func iso(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }
}
