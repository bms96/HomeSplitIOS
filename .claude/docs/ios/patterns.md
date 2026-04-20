# Homesplit iOS — Code Patterns

> Patterns the Swift codebase should follow. Read `architecture.md` first.
> These are hard rules; deviate only with a clear reason in the PR body.

---

## Supabase client

Singleton, created once, passed through the environment.

```swift
// Core/Supabase/SupabaseClientProvider.swift
import Foundation
import Supabase

protocol SupabaseClientProviding: AnyObject, Sendable {
    var client: SupabaseClient { get }
}

final class LiveSupabaseClientProvider: SupabaseClientProviding, @unchecked Sendable {
    let client: SupabaseClient

    init() {
        self.client = SupabaseClient(
            supabaseURL: Configuration.supabaseURL,
            supabaseKey: Configuration.supabaseAnon,
            options: .init(
                auth: .init(
                    storage: KeychainAuthStorage(service: "app.homesplit.ios"),
                    autoRefreshToken: true
                )
            )
        )
    }
}
```

- Replace `KeychainAuthStorage` with `InMemoryAuthStorage` in tests.
- **Never** construct a second `SupabaseClient` with a service-role key. That key
  belongs in Edge Functions only.

---

## Repository pattern

One protocol + one `Live` implementation per domain concept. Return domain models,
not DTOs.

```swift
// Core/Supabase/Repositories/ExpensesRepository.swift
protocol ExpensesRepository: Sendable {
    func list(householdID: UUID, cycleID: UUID) async throws -> [Expense]
    func add(_ input: AddExpenseInput) async throws -> Expense
    func update(id: UUID, with input: UpdateExpenseInput) async throws -> Expense
    func delete(id: UUID, householdID: UUID) async throws
}

struct LiveExpensesRepository: ExpensesRepository {
    let provider: SupabaseClientProviding

    func list(householdID: UUID, cycleID: UUID) async throws -> [Expense] {
        let rows: [ExpenseDTO] = try await provider.client
            .from("expenses")
            .select("*, paid_by_member:members(*), expense_splits(*)")
            .eq("household_id", value: householdID.uuidString)
            .eq("cycle_id", value: cycleID.uuidString)
            .order("date", ascending: false)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows.map(Expense.init(dto:))
    }

    func add(_ input: AddExpenseInput) async throws -> Expense {
        let splits = try Splits.calculateEqualSplits(
            amount: input.amount,
            memberIDs: input.memberIDs
        )
        let inserted: ExpenseDTO = try await provider.client
            .from("expenses")
            .insert(input.dto())
            .select()
            .single()
            .execute()
            .value

        _ = try await provider.client
            .from("expense_splits")
            .insert(splits.map { $0.dto(expenseID: inserted.id) })
            .execute()

        return Expense(dto: inserted).with(splits: splits)
    }
}
```

Rules:
- Every method is `async throws`. Supabase errors bubble up unmodified.
- DTOs live next to the repository that uses them, never exported outside `Core/`.
- Transform DTO → domain model at the repository boundary.
- If you need multiple inserts to be atomic, wrap them in an RPC (SQL side), not
  client-side best-effort.

---

## DTO ↔ Model

The Supabase backend uses `snake_case`. Swift models are `camelCase`. Bridge in
DTOs. Use `JSONDecoder.KeyDecodingStrategy.convertFromSnakeCase` where it fits;
for anything custom (enums, nested joins), write `CodingKeys`.

```swift
struct ExpenseDTO: Codable, Sendable {
    let id: UUID
    let householdID: UUID
    let cycleID: UUID
    let paidByMemberID: UUID
    let amount: Decimal
    let description: String
    let category: ExpenseCategory
    let date: String            // ISO yyyy-MM-dd
    let dueDate: String?
    let recurringBillID: UUID?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case householdID = "household_id"
        case cycleID = "cycle_id"
        case paidByMemberID = "paid_by_member_id"
        case amount
        case description
        case category
        case date
        case dueDate = "due_date"
        case recurringBillID = "recurring_bill_id"
        case createdAt = "created_at"
    }
}
```

- **Money columns decode as `Decimal`, never `Double`.** See `money-swift.instructions.md`.
- **Enums decode from their raw string**: `enum ExpenseCategory: String, Codable { … }`.

---

## View model pattern

```swift
// Features/Expenses/AddExpenseViewModel.swift
import Foundation
import Observation

@MainActor
@Observable
final class AddExpenseViewModel {
    enum State { case idle, saving, saved(Expense), failed(Error) }

    var amount: Decimal? = nil
    var description: String = ""
    var category: ExpenseCategory = .other
    var paidByMemberID: UUID
    var includedMemberIDs: Set<UUID>
    var state: State = .idle

    private let expenses: ExpensesRepository
    private let cycleID: UUID
    private let householdID: UUID

    init(expenses: ExpensesRepository, householdID: UUID, cycleID: UUID,
         defaultPayer: UUID, allMembers: [Member]) {
        self.expenses = expenses
        self.householdID = householdID
        self.cycleID = cycleID
        self.paidByMemberID = defaultPayer
        self.includedMemberIDs = Set(allMembers.map(\.id))
    }

    func save() async {
        guard let amount, amount > 0 else {
            state = .failed(ValidationError.invalidAmount); return
        }
        guard !description.isEmpty else {
            state = .failed(ValidationError.missingDescription); return
        }
        guard !includedMemberIDs.isEmpty else {
            state = .failed(ValidationError.noMembersIncluded); return
        }

        state = .saving
        do {
            let expense = try await expenses.add(.init(
                householdID: householdID,
                cycleID: cycleID,
                paidByMemberID: paidByMemberID,
                amount: amount,
                description: description,
                category: category,
                memberIDs: Array(includedMemberIDs)
            ))
            state = .saved(expense)
        } catch {
            state = .failed(error)
        }
    }
}
```

Rules:
- `@MainActor @Observable`. Every view model.
- Publish a `State` enum, not scattered booleans. Loading + error + success live
  together.
- Repositories are injected — never reach for the environment inside a view model.
- View models own their `Task`s; views attach them with `.task { await vm.load() }`.

---

## SwiftUI view pattern

```swift
// Features/Expenses/AddExpenseView.swift
import SwiftUI

struct AddExpenseView: View {
    @State private var vm: AddExpenseViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: AddExpenseViewModel) {
        _vm = State(wrappedValue: viewModel)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Amount") {
                    HSCurrencyField("$0.00", value: $vm.amount)
                        .accessibilityLabel("Expense amount")
                }
                Section("Details") {
                    TextField("Description", text: $vm.description)
                    Picker("Category", selection: $vm.category) {
                        ForEach(ExpenseCategory.allCases) { Text($0.displayName).tag($0) }
                    }
                }
                Section("Split") {
                    // member toggles
                }
            }
            .navigationTitle("Add expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await vm.save() } }
                        .disabled(!vm.canSave)
                }
            }
            .onChange(of: vm.state) { _, newValue in
                if case .saved = newValue { dismiss() }
            }
            .alert("Couldn't save expense",
                   isPresented: Binding(
                        get: { if case .failed = vm.state { true } else { false } },
                        set: { _ in vm.state = .idle }
                   )) {
                Button("OK", role: .cancel) { }
            }
        }
    }
}
```

Rules:
- Inject the view model. No `StateObject` factory that creates dependencies inside
  the view.
- One `NavigationStack` per presentation context (root tab or sheet).
- Buttons that perform async work: `Button("Save") { Task { await vm.save() } }`.
- Handle the whole `State` enum — every case maps to a UI state.
- Prefer `.alert(_:isPresented:actions:)` for errors; prefer inline `.overlay` for
  loading indicators.

---

## Forms & validation

- Money inputs use `HSCurrencyField` which owns a `Decimal?` and a `NumberFormatter`
  with `currencyBehavior` locale-aware.
- Validation runs in the view model (`canSave: Bool`), not in the view. The view
  only reflects.
- Error messages are copy from `docs/ios/ui-ux.md` ("Amount is required", …) — match
  the React Native wording.

---

## Navigation

```swift
// Features/Expenses/ExpensesTabView.swift
enum ExpenseRoute: Hashable {
    case detail(UUID)
    case add
}

struct ExpensesTabView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ExpensesListView(onTap: { path.append(ExpenseRoute.detail($0)) })
                .navigationDestination(for: ExpenseRoute.self) { route in
                    switch route {
                    case .detail(let id): ExpenseDetailView(id: id)
                    case .add:            EmptyView() // unused — add is a sheet
                    }
                }
                .sheet(isPresented: $showingAdd) { AddExpenseView(…) }
        }
    }
}
```

- Sheets are state-driven (`sheet(item:)` preferred when the sheet has data).
- Deep links append to the `NavigationPath`; never replace the tab from another
  tab's view.

---

## Bottom sheets

Use SwiftUI's built-in `sheet` with `.presentationDetents`. No third-party libs.

```swift
.sheet(isPresented: $vm.showingPayOptions) {
    PayOptionsSheet(debt: debt)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
}
```

---

## Error surfaces

- Network errors from Supabase → present an alert with a retryable action (not a
  crash).
- RLS denials look like HTTP 403 `postgrest` errors (`PGRST`). Decode them as
  `Homesplit.UserFacingError.notAuthorized` and show "You don't have access to this
  household."
- Never `fatalError` on a network path. `fatalError` is reserved for programming
  invariants (unreachable switch branches).

```swift
enum HomesplitError: LocalizedError {
    case notAuthorized
    case missingCycle
    case network(underlying: Error)
    case validation(String)

    var errorDescription: String? {
        switch self {
        case .notAuthorized:  "You don't have access to this household."
        case .missingCycle:   "This household has no open cycle."
        case .network(let e): "Network error: \(e.localizedDescription)"
        case .validation(let m): m
        }
    }
}
```

---

## Logging

```swift
import os

enum Log {
    static let auth     = Logger(subsystem: "app.homesplit.ios", category: "auth")
    static let supabase = Logger(subsystem: "app.homesplit.ios", category: "supabase")
    static let bills    = Logger(subsystem: "app.homesplit.ios", category: "bills")
    static let paywall  = Logger(subsystem: "app.homesplit.ios", category: "paywall")
}
```

- `Log.supabase.error("Failed to fetch expenses: \(error)")`.
- No `print(...)` outside of command-line helpers. `print` calls fail the lint
  check.

---

## RevenueCat

```swift
// Core/RevenueCat/RevenueCatService.swift
import RevenueCat

enum RevenueCatService {
    static let entitlementID = "pro_household"

    static func configure() {
        Purchases.logLevel = Configuration.isProd ? .warn : .debug
        Purchases.configure(withAPIKey: Configuration.revenueCatKey)
    }

    static func identify(household: UUID) async throws {
        _ = try await Purchases.shared.logIn("household:\(household.uuidString)")
    }

    static func resetIdentity() async {
        _ = try? await Purchases.shared.logOut()
    }

    static func isPro() async -> Bool {
        do {
            let info = try await Purchases.shared.customerInfo()
            return info.entitlements.active[entitlementID] != nil
        } catch {
            return false
        }
    }
}
```

Paywall UI:
- Use `RevenueCatUI.PaywallView()` when available (SDK ≥ 5.0).
- Fallback view in the paywall feature when running in a Simulator without RC
  configured — mirrors the RN "placeholder" behavior in `app/(app)/paywall.tsx`.

---

## Push notifications

- Register with `UNUserNotificationCenter.current().requestAuthorization([.alert, .badge, .sound])`.
- On `didRegisterForRemoteNotificationsWithDeviceToken`, hex-encode the token and
  upsert to Supabase `push_tokens` with `platform = "ios"`.
- Handle the silent push that the RN app never implemented as a stretch goal; MVP
  can ignore.
- Bill reminders and settle-up reminders come from the existing Edge Functions —
  the iOS app just needs to register the token correctly.

---

## Deeplinks

```swift
// Domain/Deeplinks/Deeplinks.swift
enum Deeplinks {
    static func inviteURL(token: String) -> URL {
        URL(string: "https://homesplit.app/join/\(token)")!
    }

    static func venmoURL(amount: Decimal, note: String, recipient: String?) -> URL? {
        let amt = Money.string(from: amount, style: .decimal2)
        let encoded = note.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        var s = "venmo://paycharge?txn=pay"
        if let recipient {
            let u = recipient.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? recipient
            s += "&recipients=\(u)"
        }
        s += "&amount=\(amt)&note=\(encoded)"
        return URL(string: s)
    }

    static func cashAppURL(amount: Decimal, cashtag: String?) -> URL? {
        if let cashtag {
            let u = cashtag.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? cashtag
            return URL(string: "https://cash.app/$\(u)/\(Money.string(from: amount, style: .decimal2))")
        }
        return URL(string: "https://cash.app")
    }
}
```

Apple-specific rules:
- Declare `LSApplicationQueriesSchemes` in `Info.plist` for `venmo` and `cashapp`
  so `UIApplication.canOpenURL` works.
- Universal links: add `https://homesplit.app` to Associated Domains entitlement
  and publish `apple-app-site-association` on the domain.

---

## Haptics

```swift
enum Haptics {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let g = UIImpactFeedbackGenerator(style: style)
        g.prepare(); g.impactOccurred()
    }
    static func notify(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let g = UINotificationFeedbackGenerator()
        g.prepare(); g.notificationOccurred(type)
    }
}
```

- Fire on: settle confirmation, payment-app handoff, move-out confirmation.
- Don't spam — no haptic on every button tap.

---

## PDF generation (move-out settlement)

Use `PDFKit` + `UIGraphicsPDFRenderer`. Render the same layout as the RN build
(`docs/ios/ui-ux.md` shows the fields). Upload to Supabase Storage bucket
`settlement-pdfs` at path `{householdID}/{moveOutID}.pdf`.

---

## Don'ts

- ❌ Force-unwrapping a Supabase query result.
- ❌ `DispatchQueue.main.async` inside a view model — use `@MainActor` and `await`.
- ❌ Creating a `SupabaseClient` outside `LiveSupabaseClientProvider`.
- ❌ `UserDefaults` for auth tokens, for RevenueCat state, or for anything sensitive.
- ❌ Synchronous file I/O on the main thread (PDF write: do it off-main and upload
  via `async` Storage API).
- ❌ Rolling your own currency parser — use `Decimal(string:locale:)` or a
  `NumberFormatter`.

---

## Referenced files

- `.claude/docs/ios/architecture.md` — layering and state model.
- `.claude/docs/ios/bills-vs-expenses.md` — the rules the money-flow patterns enforce.
- `.claude/docs/ios/backend-reference.md` — every RLS policy, RPC, trigger.
- `.github/instructions/swift-style.instructions.md` — code style, Swift 6 concurrency.
- `.github/instructions/supabase-swift.instructions.md` — per-feature Supabase rules.
