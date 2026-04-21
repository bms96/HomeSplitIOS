import Foundation

/// Result returned from presenting the paywall.
enum PaywallPresentationResult: Sendable {
    case purchased
    case cancelled
    case error
    case unavailable
}

/// Abstraction over the RevenueCat SDK so the app compiles and runs in
/// environments where the SPM package isn't wired yet (simulator previews,
/// dev builds without the native framework). The `StubRevenueCatClient`
/// below implements the offline/unavailable path — identical semantics to
/// Expo Go in the RN reference. The live implementation lands with the
/// RevenueCat SPM wiring in a follow-up.
protocol RevenueCatClient: Sendable {
    var isAvailable: Bool { get }
    func configure(appUserID: String?)
    func identifyHousehold(id: UUID) async
    func resetIdentity() async
    func hasProEntitlement() async -> Bool
    func presentPaywall() async -> PaywallPresentationResult
}

/// No-op implementation used when the RevenueCat SDK isn't linked.
/// Every call returns the "unavailable" path so the gate falls back to the
/// fallback paywall sheet instead of crashing.
struct StubRevenueCatClient: RevenueCatClient {
    let isAvailable: Bool = false

    func configure(appUserID: String?) {}
    func identifyHousehold(id: UUID) async {}
    func resetIdentity() async {}
    func hasProEntitlement() async -> Bool { false }
    func presentPaywall() async -> PaywallPresentationResult { .unavailable }
}

/// Entitlement identifier configured in the RevenueCat dashboard. The
/// household row in `subscriptions` is the server-side mirror of this.
enum RevenueCatConstants {
    static let proEntitlementId = "HomeSplit Pro"
}
