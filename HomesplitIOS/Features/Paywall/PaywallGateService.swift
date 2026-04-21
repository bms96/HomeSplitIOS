import Foundation
import Observation

enum PaywallDecision: Sendable, Equatable {
    case allow
    case blocked(PaywallTrigger)
}

/// Decides whether a Pro-gated action can run, consulting both the Postgres
/// `subscriptions` row (server-side truth, kept fresh by the RevenueCat
/// webhook) and the live RC CustomerInfo (so a just-completed purchase
/// unlocks immediately before the webhook round-trip).
@Observable
@MainActor
final class PaywallGateService {
    private let subscriptionsRepo: any SubscriptionsRepositoryProtocol
    private let revenueCat: any RevenueCatClient

    init(
        subscriptionsRepo: any SubscriptionsRepositoryProtocol,
        revenueCat: any RevenueCatClient
    ) {
        self.subscriptionsRepo = subscriptionsRepo
        self.revenueCat = revenueCat
    }

    func isPro(householdId: UUID) async -> Bool {
        let dbActive: Bool
        do {
            let sub = try await subscriptionsRepo.current(householdId: householdId)
            dbActive = sub?.isActive ?? false
        } catch {
            dbActive = false
        }
        if dbActive { return true }
        guard revenueCat.isAvailable else { return false }
        return await revenueCat.hasProEntitlement()
    }

    func evaluate(householdId: UUID, trigger: PaywallTrigger) async -> PaywallDecision {
        if await isPro(householdId: householdId) { return .allow }
        return .blocked(trigger)
    }

    /// Attempts to present the paywall. Returns `true` if the user purchased
    /// (or restored) and the caller should proceed with the gated action.
    /// Returns `false` for cancel/error/unavailable — the caller should
    /// surface the fallback sheet or an error as appropriate.
    func presentPaywall() async -> Bool {
        guard revenueCat.isAvailable else { return false }
        switch await revenueCat.presentPaywall() {
        case .purchased: return true
        case .cancelled, .error, .unavailable: return false
        }
    }

    var isRevenueCatAvailable: Bool { revenueCat.isAvailable }
}
