---
description: "Use when writing or modifying any Swift file in the iOS app. Covers Swift 6 concurrency, naming, error handling, observation, and force-unwrap policy."
applyTo: "HomesplitIOS/**/*.swift"
---

# Swift Style & Concurrency

## Critical Rules
- Target Swift 6 with strict concurrency. Treat data-race warnings as errors.
- iOS 17.0 minimum. Prefer `@Observable` over `ObservableObject`/`@Published`.
- No `print(...)` outside `#if DEBUG`. Use `Logger(subsystem:category:)` from `os`.
- No force-unwraps (`!`) except `IBOutlet`-style late-init or invariants justified
  by a one-line comment. Prefer `guard let` + throw.
- No `try!` and no `as!` in production code paths.
- No `Any` / `AnyObject` in domain types — model unions as enums with associated values.

## Naming
- Types `UpperCamelCase`, members `lowerCamelCase`. Acronyms uppercased
  consistently — `URL`, `ID`, `PDF`. View-model class suffix is `ViewModel`,
  not `VM`. Repository protocol suffix is `Repository`, live impl prefix `Live`.
- Booleans read as predicates: `isLoading`, `hasUnsettledSplits`,
  `canMarkPaid`. Avoid `flag`, `done`, ambiguous nouns.
- File name matches the primary type. One top-level public type per file.

## Concurrency
- View models: `@MainActor @Observable final class FooViewModel { ... }`.
- Repositories: `actor` if they hold mutable state (caches), otherwise plain
  `struct`/`final class` with `Sendable` conformance.
- Network calls: `async throws`. Never block the main thread; never use
  semaphores. No `DispatchQueue.main.async` — use `await MainActor.run` or
  hop via `@MainActor` boundary.
- Long work runs in a child task and surfaces via `try await`.
  Cancellation: honor `Task.checkCancellation()` in long loops.
- Every type crossing concurrency boundaries is `Sendable`. Mark domain
  models `Sendable`; mark UI-facing reference types `@MainActor` or
  `final class ... : Sendable` with no shared mutable state.

## Error Handling
- Throw typed errors via `enum HomesplitError: LocalizedError`. Provide
  `errorDescription` for any error a user can see.
- At UI boundaries: `do { try await ... } catch { vm.error = error }`.
  Never swallow errors silently — log at minimum.
- For Supabase/RLS denials, decode into `HomesplitError.notAuthorized` so
  the UI can show the canonical "You don't have permission" copy.

## Observation & State
- View models own their state. Views read it via `@Bindable` or by passing
  the model down as `@Environment` or constructor injection.
- Don't mix `@Published`/`Combine` into new code; bridge only when
  unavoidable (e.g., legacy SDK callbacks).
- Computed properties are fine on `@Observable` classes — Observation
  tracks dependencies automatically.

## Imports
- `Domain/` files import only `Foundation`. No `SwiftUI`, no `UIKit`,
  no `Supabase`. Domain must compile on Linux for fast unit tests.
- `Features/` may import `Domain`, `Core`, `Components`, `DesignSystem`.
- No reverse imports (`Core` cannot import `Features`).

## Comments
- Default to no comments. Add one only when the *why* is non-obvious
  (a workaround, a hidden invariant, a server-side coupling).
- No "// added for X" or PR-context comments.

See `.claude/docs/ios/architecture.md` and `.claude/docs/ios/patterns.md`
for the full architecture and example code.
