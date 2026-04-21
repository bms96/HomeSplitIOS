import Foundation
import Observation

/// Loads and exposes the active member roster for the Household overview.
@Observable
@MainActor
final class HouseholdViewModel {
    private(set) var members: [Member] = []
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?

    let householdId: UUID
    private let repository: any HouseholdRepositoryProtocol

    init(householdId: UUID, repository: any HouseholdRepositoryProtocol) {
        self.householdId = householdId
        self.repository = repository
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            members = try await repository.members(householdId: householdId)
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }
}
