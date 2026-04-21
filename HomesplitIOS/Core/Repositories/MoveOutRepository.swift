import Foundation
import Supabase

protocol MoveOutRepositoryProtocol: Sendable {
    /// Finalize a move-out. Returns the new `move_outs` row id.
    /// Server prorates splits, closes the cycle if needed, redistributes
    /// remaining balances, and sets `members.left_at`.
    func complete(
        householdId: UUID,
        memberId: UUID,
        moveOutDateIso: String
    ) async throws -> UUID

    /// Fetch a move-out row by id (used after `complete` to read prorated totals).
    func fetch(id: UUID) async throws -> MoveOut

    /// Upload a locally-generated settlement PDF to Storage and patch
    /// `move_outs.pdf_url` with the signed URL. Best-effort — errors propagate
    /// so callers can decide whether to fall back to local share.
    func uploadPdf(moveOutId: UUID, householdId: UUID, fileURL: URL) async throws -> String
}

struct MoveOutRepository: MoveOutRepositoryProtocol {
    private let provider: any SupabaseClientProviding
    private let bucket = "settlement-pdfs"

    init(provider: any SupabaseClientProviding) {
        self.provider = provider
    }

    private func requireClient() throws -> SupabaseClient {
        guard Configuration.isSupabaseConfigured else {
            throw ConfigurationError.supabaseNotConfigured
        }
        return provider.client
    }

    func complete(
        householdId: UUID,
        memberId: UUID,
        moveOutDateIso: String
    ) async throws -> UUID {
        let client = try requireClient()
        struct Params: Encodable {
            let p_household_id: UUID
            let p_member_id: UUID
            let p_move_out_date: String
        }
        return try await client
            .rpc("complete_move_out", params: Params(
                p_household_id: householdId,
                p_member_id: memberId,
                p_move_out_date: moveOutDateIso
            ))
            .execute()
            .value
    }

    func fetch(id: UUID) async throws -> MoveOut {
        let client = try requireClient()
        let rows: [MoveOut] = try await client
            .from("move_outs")
            .select()
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        guard let row = rows.first else {
            throw MoveOutError.notFound
        }
        return row
    }

    func uploadPdf(moveOutId: UUID, householdId: UUID, fileURL: URL) async throws -> String {
        let client = try requireClient()
        let path = "\(householdId.uuidString)/\(moveOutId.uuidString).pdf"
        let data = try Data(contentsOf: fileURL)
        _ = try await client.storage
            .from(bucket)
            .upload(
                path,
                data: data,
                options: FileOptions(contentType: "application/pdf", upsert: true)
            )
        let signed = try await client.storage
            .from(bucket)
            .createSignedURL(path: path, expiresIn: 60 * 60 * 24 * 365)
        let urlString = signed.absoluteString
        struct Patch: Encodable { let pdf_url: String }
        try await client
            .from("move_outs")
            .update(Patch(pdf_url: urlString))
            .eq("id", value: moveOutId)
            .execute()
        return urlString
    }
}

enum MoveOutError: Error, LocalizedError {
    case notFound

    var errorDescription: String? {
        switch self {
        case .notFound: return "Move-out record not found."
        }
    }
}
