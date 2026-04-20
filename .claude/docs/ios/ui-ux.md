# Homesplit iOS — UI / UX

> SwiftUI-native UI guidance. When in doubt, follow Apple's Human Interface Guidelines,
> not Material Design. HIG: <https://developer.apple.com/design/human-interface-guidelines/>

---

## Design principles (non-negotiable)

1. **Trust first** — money is involved. Every screen feels secure and transparent.
   Never show stale data without a loading indicator; never fail silently.
2. **One primary action** per screen. Never compete for attention with multiple
   equal-weight buttons.
3. **Zero friction for the common case** — add expense < 10 seconds. Recurring
   bills: zero monthly action by the user.
4. **Progressive disclosure** — show defaults first, reveal options on tap.
5. **Respect iOS conventions.** Navigation bars, tab bars, sheets with detents,
   SF Symbols, swipe-to-delete in lists.

---

## Design tokens

Define tokens in `DesignSystem/`. Never reference raw hex or raw numbers in views.

### Colors

```swift
// DesignSystem/Colors.swift
import SwiftUI

enum Palette {
    static let primary     = Color("Primary")      // #1F6FEB
    static let primaryBg   = Color("PrimaryBg")    // #D8E8FD
    static let success     = Color("Success")      // #16A34A
    static let successBg   = Color("SuccessBg")    // #DCFCE7
    static let warning     = Color("Warning")      // #D97706
    static let warningBg   = Color("WarningBg")    // #FEF3C7
    static let danger      = Color("Danger")       // #DC2626
    static let dangerBg    = Color("DangerBg")     // #FEE2E2
    static let textPrimary = Color("TextPrimary")  // #111827 light / #F9FAFB dark
    static let textSecondary = Color("TextSecondary") // #6B7280 light / #9CA3AF dark
    static let surface     = Color("Surface")      // #F9FAFB light / #111827 dark
}
```

Each named color above has a light + dark variant in `Assets.xcassets`. Do not
ship with hard-coded hex values in Swift — declare them in the asset catalog so
Dark Mode works.

**Semantic rules**
- Positive balance (owed to user): `Palette.success` on `Palette.successBg`.
- Negative balance (user owes): `Palette.danger` on `Palette.dangerBg`.
- Pending / unsettled: `Palette.warning` on `Palette.warningBg`.
- Neutral: `.primary` / `.secondary` system colors on the default background.
- Color is **never** the only signal — always pair with an SF Symbol and/or text.

### Typography

Prefer SwiftUI's semantic font styles so Dynamic Type scales automatically.

```swift
// DesignSystem/Typography.swift
extension Font {
    static let hsDisplay = Font.system(size: 34, weight: .bold)   // dashboard big number
    static let hsTitle1  = Font.title                              // screen titles
    static let hsTitle2  = Font.title2
    static let hsTitle3  = Font.title3
    static let hsBody    = Font.body
    static let hsCallout = Font.callout
    static let hsSubhead = Font.subheadline
    static let hsFootnote = Font.footnote
    static let hsCaption  = Font.caption
    static let hsMono     = Font.system(.body, design: .monospaced)
}
```

Use these when you need a tweak. Default to `Font.title2`, `Font.body`, etc.

### Spacing

4pt grid. No odd numbers. No 14, no 15.

```swift
enum Spacing {
    static let xs:   CGFloat = 4
    static let sm:   CGFloat = 8
    static let md:   CGFloat = 12
    static let base: CGFloat = 16   // default screen horizontal padding
    static let lg:   CGFloat = 20
    static let xl:   CGFloat = 24
    static let xxl:  CGFloat = 32
    static let xxxl: CGFloat = 48
}
```

### Component sizes

| Component | Height | Notes |
|---|---|---|
| Primary button | 50 | Full width in forms. Corner radius 12. |
| Secondary button | 44 | Outlined, tint `.primary`. |
| Input field | 48 | Rounded rectangle. |
| Card | auto | Corner radius 12, subtle shadow (`.shadow(radius: 4, y: 2)`) in light mode. |
| List row | 56 min | Use `List` with `.listStyle(.insetGrouped)` where appropriate. |
| Avatar | 36 | Circle. Show initials fallback. |
| Tab bar | system default | Don't override. |
| FAB-equivalent | 56 | Use `.toolbar { ToolbarItem(placement: .primaryAction) { … } }` or a floating `Button` with `.buttonStyle(.borderedProminent)` — follow HIG; don't copy Android FAB literally. |

---

## Navigation

**4 bottom tabs** (in order):

| Tab | SF Symbol | Badge |
|---|---|---|
| Home | `house.fill` | Unsettled count |
| Expenses | `list.bullet` | — |
| Bills | `arrow.triangle.2.circlepath` | Overdue count |
| Household | `person.2.fill` | — |

Each tab uses its own `NavigationStack`. Deep links route through the root,
which switches to the correct tab and pushes onto its path.

**Sheet map** (where an RN route was modal or bottom-sheet):

- Add / edit expense → `AddExpenseView` in a `.sheet` with `.large` detent.
- Add / edit bill → `BillFormView` in a `.sheet`.
- Paywall → `.sheet` with `.large` detent; use `RevenueCatUI.PaywallView` when
  available.
- Pay options (Venmo / Cash App) → `.sheet` with `.medium` detent.

**Not a sheet:** settle-up, balance breakdown, move-out, household settings,
categories — these push on the nav stack.

---

## Screen specs (critical paths)

These mirror the React Native screens to maintain user-visible parity.

### Dashboard (Home tab)

- Header: household name + current cycle range (e.g., "May 1 – May 31").
- Three stat cards: **You owe**, **Owed to you**, **Bills due**. Tap → settle-up
  or bills list.
- Section: **Bills due** (first 3 overdue / upcoming).
- Section: **You owe** (bills & expenses where the user is the debtor — lets them
  mark paid inline).
- Section: **Recent transactions** (limit 5).
- Empty state ("Get started"): links to invite, add bills, log expense.
- Primary action: add expense (floating `Button` bottom-right or nav-bar trailing
  item).

### Expenses

- Header: "This cycle" count + total, filter chips (`Unpaid / Paid / Both`), sort
  button (`ActionSheet` with asc/desc toggles).
- List of `ExpenseCard` rows. Swipe-to-edit on the payer's own rows.
- Empty state: "No expenses yet" with CTA.
- Add expense sheet: amount (currency keyboard), description, category chips, paid
  by chips, split toggle (everyone / custom members), optional due date.

### Bills

- Header: "Recurring bills" + subtitle.
- List of `RecurringBillCard` rows with paid-count badge.
- Overdue bills pinned to top.
- Empty state: "No recurring bills".
- Bill detail: full form with variable-amount cycle override.

### Household

- Members list with avatars + balances.
- Footer actions: Invite roommates, Manage categories, Move out, Sign out.
- Invite screen: share invite URL, rotate link, copy-to-clipboard (haptic
  confirmation).
- Settings screen: rename household, rename self; dev-only reset section under
  `#if DEBUG`.

### Move-out flow

Three steps:
1. **Pick** departing member and date.
2. **Review** proration table (itemized) + net balance.
3. **Done** with PDF share sheet.

### Paywall

- Primary: RevenueCat-rendered paywall (SDK-provided UI).
- Fallback: simple view if RevenueCat is unavailable (e.g., Simulator without
  StoreKit config). Text matches RN placeholder.

---

## Empty states

| Screen | Symbol | Headline | Body |
|---|---|---|---|
| Dashboard | `house` | "Your household is set up!" | "Add your first expense to get started." |
| Expenses | `list.bullet` | "No expenses yet" | "Tap + to add the first one." |
| Bills | `arrow.triangle.2.circlepath` | "No recurring bills" | "Add rent, utilities, and subscriptions." |
| Household | `person.2` | "Just you so far" | "Invite roommates to split costs." |
| Settle up | `checkmark.circle` | "All settled up!" | "No outstanding balances." |
| Move-outs | `arrow.right.square` | "No move-outs pending" | "Use this when a roommate leaves." |

Each empty state gets a faint SF Symbol, a short headline (`.title3`), a one-line
body (`.subheadline`, `.secondary` color), and optionally a CTA button.

---

## Error copy (canonical strings)

| Error | Message | Recovery |
|---|---|---|
| Network offline | "No internet — try again in a moment." | "Retry" |
| Save failed | "Couldn't save expense. Try again." | "Retry" |
| Magic link expired | "That link has expired. Request a new one." | Re-enter email |
| Invite invalid | "This invite link isn't valid or has expired." | Back |
| Subscription check failed | "Couldn't verify subscription. Using cached status." | "Refresh" |
| Split doesn't sum | "Split amounts must add up to $X.XX." | Inline |
| Member already in household | "This person is already in your household." | Dismiss |

Match these exactly — they appear in the RN build and users may see both until
the RN build sunsets.

---

## Accessibility

Every interactive view must:

- Set `accessibilityLabel` — describe the action, not the visual ("Delete expense",
  not "Trash icon").
- Use `accessibilityAddTraits(.isButton)` where the view isn't already a button.
- Minimum touch target 44×44. Wrap small symbols in a padded `Button` if needed.
- Respect Dynamic Type — don't fix sizes with `.font(.system(size: 17))`. Use the
  semantic styles or clamp with `.dynamicTypeSize(.large ... .accessibility3)` if
  the layout breaks at XXL.
- WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text. Our `TextSecondary`
  is safe on `surface`; `Palette.primary` on white is 4.6:1.
- VoiceOver: group related labels with `.accessibilityElement(children: .combine)`
  on rows so the whole row reads as one unit.
- Reduce Motion: `@Environment(\.accessibilityReduceMotion)` — skip animated
  number tickers and ease-outs if true.

---

## Haptics

- **Impact (medium)** on confirming a destructive action (delete, move-out).
- **Notification (success)** on settle confirmation, mark-paid, add expense.
- **Impact (soft)** on payment-app handoff.
- Never on every button tap. Haptic overload dulls the useful ones.

```swift
Haptics.notify(.success)
```

---

## Dynamic Type, Dark Mode, localization

- Ship with Dynamic Type working. Test at the largest accessibility size at least
  once per screen — fix truncation with `minimumScaleFactor(0.8)` or wrap into
  two lines.
- Dark Mode is free once colors live in the asset catalog. Verify the dashboard
  stat cards and the paywall at minimum.
- MVP ships English-only. Still put user-facing strings in `Localizable.xcstrings`
  so V2 can add Spanish without a refactor.

---

## SwiftUI code rules

1. **One view per file**, ≤ ~200 lines. Extract subviews in the same file first,
   split to a new file when it exceeds 200.
2. **No view models inside `View.init`** — inject from the caller. This keeps
   previews cheap.
3. **Previews**: every top-level view has a `#Preview` with at least one fixed
   data state.
4. **Use `List` for feed-like content**, not `ScrollView` with a `LazyVStack`
   unless you need custom scrolling behavior.
5. **Sheets use SwiftUI**, not UIKit `present(_:)`. No custom absolute-positioning
   hacks.
6. **Animations** are short (≤ 250ms) and honor `accessibilityReduceMotion`.
7. **Buttons trigger `Task { await vm.action() }`**, never `DispatchQueue`.
8. **Currency** formatting: `amount.formatted(.currency(code: "USD"))`.

---

## AI code generation rules for iOS UI

When generating SwiftUI, always:

1. Import design tokens from `DesignSystem/` — never raw hex or raw numbers.
2. Use SF Symbols (by name). Don't embed PNG icons in-app for system-y UI.
3. Attach `accessibilityLabel` + `accessibilityAddTraits` to interactive views.
4. Handle loading AND error states when the view depends on network data.
5. Keep the view under 200 lines; extract subviews.
6. Sheets use `.sheet(isPresented:)` / `.sheet(item:)` with `.presentationDetents`.
7. Currency uses `formatted(.currency(code: "USD"))`, never `"$\(x)"`.
8. Don't use `@StateObject` — use `@State private var vm: Foo` with a
   `@Observable` view model.
9. Don't hardcode `.fixed(size:)` fonts for text content. Use the semantic scale.
10. No `UIScreen.main.bounds` — read sizes from `GeometryReader` only when you
    genuinely need them.

---

## Referenced files

- `.claude/docs/ios/architecture.md` — layers, state, nav model.
- `.claude/docs/ios/patterns.md` — concrete Swift patterns.
- `.github/instructions/swiftui.instructions.md` — per-view-file rules.
