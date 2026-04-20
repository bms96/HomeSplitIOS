import Foundation
import Observation

/// Observable holder for the current user's household membership.
/// RootView reads this to decide whether to show the onboarding flow
/// or the main tab bar.
@Observable
@MainActor
final class HouseholdSession {
    private(set) var membership: MembershipWithHousehold?
    private(set) var isLoaded: Bool = false
    private(set) var lastError: String?

    private let repository: any HouseholdRepositoryProtocol

    init(repository: any HouseholdRepositoryProtocol) {
        self.repository = repository
    }

    func refresh(userId: UUID) async {
        do {
            membership = try await repository.currentHousehold(userId: userId)
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
        isLoaded = true
    }

    func clear() {
        membership = nil
        isLoaded = false
        lastError = nil
    }

    var hasHousehold: Bool { membership != nil }
}
