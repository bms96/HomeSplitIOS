---
description: "Use when writing or modifying Supabase client code, repositories, DTOs, or any code that talks to the Supabase backend (PostgREST, RPCs, Auth, Realtime, Storage)."
applyTo: "HomesplitIOS/Core/Supabase/**, HomesplitIOS/Features/**"
---

# Supabase (Swift) Patterns

## Critical Rules
- **Never** instantiate `SupabaseClient` inside a view or view model. The
  client is provided by `SupabaseClientProviding` and injected via
  `@Environment` / DI.
- **Never** ship the service-role key. Only the anon key, read at runtime
  from `Configuration.supabaseAnon` (xcconfig-backed Info.plist value).
- **Auth tokens go to Keychain** via `KeychainAuthStorage` (the
  `AuthLocalStorage` adapter). Never `UserDefaults` for tokens.
- All Supabase calls live in a **repository** method that returns
  `async throws -> T`. Views observe view models that call repositories.

## Repository Shape
```swift
protocol ExpensesRepository: Sendable {
    func list(householdID: UUID, cycleID: UUID) async throws -> [Expense]
    func add(_ draft: ExpenseDraft) async throws -> Expense
}

struct LiveExpensesRepository: ExpensesRepository {
    let client: SupabaseClient
    func list(householdID: UUID, cycleID: UUID) async throws -> [Expense] {
        let dtos: [ExpenseDTO] = try await client
            .from("expenses")
            .select("*, expense_splits(*)")
            .eq("household_id", value: householdID)
            .eq("cycle_id", value: cycleID)
            .order("date", ascending: false)
            .execute()
            .value
        return dtos.map(Expense.init)
    }
}
```

## DTOs vs Domain Models
- DTOs (`*DTO`) live next to the repository, decode the raw Supabase
  payload, and use explicit `CodingKeys` for snake_case columns.
- Domain models (`Domain/Models/*`) are clean Swift types — no
  `Codable`, no JSON concerns, only `Sendable` + `Identifiable`.
- Map DTO → Model in the repository. Never let a DTO leak into
  `Features/*` or `Domain/*`.

## Decoding
- Use a single shared `JSONDecoder.supabase` static with the date strategy
  Supabase actually returns (ISO-8601 with fractional seconds for
  `timestamptz`, plain `yyyy-MM-dd` for `date` columns — use a custom
  decoder for `Date` properties bound to `date` columns).
- For nullable enum columns, decode as optional and provide a sane
  default in the model init.

## Filters & RLS
- Always filter by `household_id` even when RLS would do it for you —
  defense in depth against a bad policy.
- Active members: `.is("left_at", value: nil)`.
- Server returns `403` with a `PGRST` code for RLS denials. Map to
  `HomesplitError.notAuthorized` in a single catch site.

## RPC Calls
- Wrap every RPC in a typed method on the relevant repository. Inputs
  are a parameter struct; output is the documented return type.
- The available RPCs are: `create_household`, `join_household_by_token`,
  `rotate_invite_token`, `settle_pair`, `complete_move_out`. See
  `.claude/docs/ios/backend-reference.md` for signatures.
- Never call helper RPCs directly from the client (`is_household_member`,
  `was_household_member` — they exist for RLS).

## Realtime
- Subscribe in the view model's `start()` method; unsubscribe in
  `stop()` (called from `.task` modifier's cancellation).
- One subscription per (table, household) — don't open a channel per row.

## Storage
- `settlement-pdfs` bucket only. Path: `{household_id}/{move_out_id}.pdf`.
- Upload with `contentType: "application/pdf"`. Persist the resulting URL
  on `move_outs.pdf_url`.

## Don't
- ❌ Don't compose SQL strings client-side; use the query builder.
- ❌ Don't read `recurring_bills.amount` directly when displaying a cycle
  amount — resolve through `bill_cycle_amounts` first (see
  `bills-vs-expenses.md`).
- ❌ Don't bypass the payer-self-split filter when consuming
  `expense_splits.settled_at`.

See `.claude/docs/ios/patterns.md` for full repository code, DTO bridging,
and `.claude/docs/ios/backend-reference.md` for the schema reference.
