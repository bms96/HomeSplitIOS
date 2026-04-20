import Foundation
import Supabase

/// Member row joined with its household — what the dashboard reads on launch.
/// Mirrors the `members?select=*,household:households(*)` shape the RN app uses.
struct MembershipWithHousehold: Codable, Hashable, Sendable {
    let id: UUID
    let householdId: UUID
    let userId: UUID?
    let displayName: String
    let phone: String?
    let color: String
    let joinedAt: Date
    let leftAt: Date?
    let household: Household

    var member: Member {
        Member(
            id: id,
            householdId: householdId,
            userId: userId,
            displayName: displayName,
            phone: phone,
            color: color,
            joinedAt: joinedAt,
            leftAt: leftAt
        )
    }

    enum CodingKeys: String, CodingKey {
        case id
        case householdId = "household_id"
        case userId      = "user_id"
        case displayName = "display_name"
        case phone
        case color
        case joinedAt    = "joined_at"
        case leftAt      = "left_at"
        case household
    }
}

protocol HouseholdRepositoryProtocol: Sendable {
    func currentHousehold(userId: UUID) async throws -> MembershipWithHousehold?
    func members(householdId: UUID) async throws -> [Member]
    func createHousehold(
        name: String,
        displayName: String,
        timezone: String,
        cycleStartDay: Int
    ) async throws -> UUID
    func joinHousehold(token: String) async throws -> UUID
    func rotateInviteToken(householdId: UUID) async throws -> String
    func updateHouseholdName(householdId: UUID, name: String) async throws
    func updateMemberDisplayName(memberId: UUID, displayName: String) async throws
}

struct HouseholdRepository: HouseholdRepositoryProtocol {
    private let provider: any SupabaseClientProviding

    init(provider: any SupabaseClientProviding) {
        self.provider = provider
    }

    private func requireClient() throws -> SupabaseClient {
        guard Configuration.isSupabaseConfigured else {
            throw ConfigurationError.supabaseNotConfigured
        }
        return provider.client
    }

    func currentHousehold(userId: UUID) async throws -> MembershipWithHousehold? {
        let client = try requireClient()
        let rows: [MembershipWithHousehold] = try await client
            .from("members")
            .select("*, household:households(*)")
            .eq("user_id", value: userId)
            .is("left_at", value: nil)
            .order("joined_at", ascending: true)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func members(householdId: UUID) async throws -> [Member] {
        let client = try requireClient()
        return try await client
            .from("members")
            .select()
            .eq("household_id", value: householdId)
            .is("left_at", value: nil)
            .order("joined_at", ascending: true)
            .execute()
            .value
    }

    func createHousehold(
        name: String,
        displayName: String,
        timezone: String = "America/New_York",
        cycleStartDay: Int = 1
    ) async throws -> UUID {
        let client = try requireClient()
        struct Params: Encodable {
            let p_name: String
            let p_display_name: String
            let p_timezone: String
            let p_cycle_start_day: Int
        }
        return try await client
            .rpc("create_household", params: Params(
                p_name: name,
                p_display_name: displayName,
                p_timezone: timezone,
                p_cycle_start_day: cycleStartDay
            ))
            .execute()
            .value
    }

    func joinHousehold(token: String) async throws -> UUID {
        let client = try requireClient()
        struct Params: Encodable { let token: String }
        return try await client
            .rpc("join_household_by_token", params: Params(token: token))
            .execute()
            .value
    }

    func rotateInviteToken(householdId: UUID) async throws -> String {
        let client = try requireClient()
        struct Params: Encodable { let hid: UUID }
        return try await client
            .rpc("rotate_invite_token", params: Params(hid: householdId))
            .execute()
            .value
    }

    func updateHouseholdName(householdId: UUID, name: String) async throws {
        let client = try requireClient()
        struct Update: Encodable { let name: String }
        try await client
            .from("households")
            .update(Update(name: name))
            .eq("id", value: householdId)
            .execute()
    }

    func updateMemberDisplayName(memberId: UUID, displayName: String) async throws {
        let client = try requireClient()
        struct Update: Encodable {
            let display_name: String
        }
        try await client
            .from("members")
            .update(Update(display_name: displayName))
            .eq("id", value: memberId)
            .execute()
    }
}
