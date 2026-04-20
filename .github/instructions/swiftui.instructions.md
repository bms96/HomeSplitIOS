---
description: "Use when writing or modifying SwiftUI views, screens, components, or design-system tokens. Covers tokens, navigation, sheets, accessibility, and Dynamic Type."
applyTo: "HomesplitIOS/Features/**, HomesplitIOS/Components/**, HomesplitIOS/DesignSystem/**"
---

# SwiftUI Patterns & Design System

## Critical Rules
- Import colors from `DesignSystem.Colors`, spacing from `DesignSystem.Spacing`,
  typography from `DesignSystem.Typography`. **No raw hex, no raw padding numbers,
  no `.font(.system(size: 17))`** in views.
- One view per file, ≤ ~200 lines. Extract subviews when it grows.
- Every interactive view: `.accessibilityLabel(_:)`, appropriate trait
  (`.isButton`, `.isHeader`), and a touch target ≥ 44×44.
- Currency: `amount.formatted(.currency(code: "USD"))`. Never `"$\(amount)"`.

## View Shape
```swift
struct AddExpenseView: View {
    @Bindable var vm: AddExpenseViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                // sections
            }
            .navigationTitle("Add expense")
            .toolbar { /* Cancel + Save */ }
        }
    }
}
```
- View has no business logic; it binds to the view model and calls
  `Task { await vm.save() }`.
- No fetch / Supabase calls inside `.task` modifiers in `Components/*` — those
  belong to feature views via their view model.

## Navigation
- Each tab owns its own `NavigationStack` with a tab-scoped `NavigationPath`.
- Routes are `Hashable` enums per feature: `enum ExpenseRoute: Hashable { ... }`.
- Sheets via `.sheet(isPresented:)` + `.presentationDetents([.medium, .large])`.
  No third-party bottom-sheet libraries; no absolute-positioned overlays.
- Deeplinks resolve at `HomesplitApp.onOpenURL` and push onto the right
  tab path — never call view-model code from a scene shim.

## State
- `@State` for view-local UI (toggles, focus). `@Bindable var vm` for the
  feature's view model. `@Environment(\.foo)` for app-wide services.
- No `@StateObject` (we're on `@Observable`). No `@ObservedObject` in new code.
- Lists: `ForEach(items, id: \.id)` — every model is `Identifiable`.

## Loading & Error States
Every data-fetching screen handles three states:
1. Loading — `ProgressView()` (or skeleton row count for lists).
2. Error — copy from the canonical set in `.claude/docs/ios/ui-ux.md` plus a
   "Try again" button that re-runs the fetch.
3. Empty — SF Symbol + one-line copy + primary CTA. See the empty-state table
   in the UI/UX doc.

## Dynamic Type & Accessibility
- Use semantic styles: `.body`, `.title2`, `.caption`. Custom sizes only via
  `DesignSystem.Typography`.
- Test at `.xxxLarge` and `.accessibility3` — text must wrap, never truncate
  silently. Use `.lineLimit(nil)` where copy is dense.
- Pair color with shape/weight; never communicate state by color alone (RC
  membership of a member, paid vs unpaid bill).
- VoiceOver: read order for `BalanceCard` is "label, amount, member count."
  Group via `.accessibilityElement(children: .combine)`.

## Tabs (4, fixed)
Home · Expenses · Bills · Household. Badges only on Home (unsettled count) and
Bills (overdue count). SF Symbols: `house.fill`, `dollarsign.circle.fill`,
`calendar`, `person.2.fill`.

## Haptics
`UIImpactFeedbackGenerator(style: .light)` on tab-bar destructive confirms;
`.success` notification haptic on successful settle / mark-paid; never on
neutral taps.

## Don't
- ❌ `GeometryReader` for layout that `containerRelativeFrame` or `Layout`
  can do.
- ❌ Custom modal stacks. Use `.sheet`, `.fullScreenCover`, `.alert`, `.confirmationDialog`.
- ❌ Snapshot tests. Use SwiftUI Previews + manual review.
- ❌ Mutating `@State` from `init` — set defaults at the property declaration.

See `.claude/docs/ios/ui-ux.md` for tokens, screen specs, and copy.
