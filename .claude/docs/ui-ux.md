# Homesplit — UI/UX Guidelines

> Referenced from `CLAUDE.md`. Read this file when building screens, components, or working on styling/layout.
> Full specification: `Homesplit_UI_UX_Specification.docx`.

---

## Design Principles (non-negotiable)

1. **Trust first** — money is involved. Every screen must feel secure and transparent. Never show stale data without a loading indicator; never fail silently.
2. **One primary action** — every screen has exactly one CTA. Never compete for attention with multiple equal-weight buttons.
3. **Zero friction for the common case** — add expense < 10 seconds. Recurring bills should require zero monthly action from the user.
4. **Progressive disclosure** — show defaults first, reveal options on tap. Don't front-load complexity.
5. **Respect platform conventions** — don't fight iOS or Android patterns; users already know them.

---

## Color Tokens

Always use these tokens. Never use raw hex values in component code.

```typescript
// src/constants/colors.ts
export const Colors = {
  primary:   '#1F6FEB',  // Blue — primary actions, links, active tabs
  primaryBg: '#D8E8FD',  // Light blue — callout backgrounds, selected states
  success:   '#16A34A',  // Green — positive balances, "you are owed"
  successBg: '#DCFCE7',  // Light green — success callout backgrounds
  warning:   '#D97706',  // Amber — unsettled amounts, overdue bills
  warningBg: '#FEF3C7',  // Light amber — warning callout backgrounds
  danger:    '#DC2626',  // Red — errors, "you owe", destructive actions
  dangerBg:  '#FEE2E2',  // Light red — error callout backgrounds
  dark:      '#111827',  // Primary text
  mid:       '#6B7280',  // Secondary text, labels
  light:     '#9CA3AF',  // Placeholder text, disabled
  surface:   '#F9FAFB',  // Card backgrounds, alternating table rows
  white:     '#FFFFFF',  // Screen background, primary card fill
} as const;

// Platform accent (use for platform-specific highlights only)
export const PlatformAccent = Platform.OS === 'ios' ? '#007AFF' : '#6750A4';
```

**Semantic rules:**
- Positive balance (owed to user) → `success` text on `successBg` background
- Negative balance (user owes) → `danger` text on `dangerBg` background
- Pending/unsettled → `warning` text on `warningBg` background
- Neutral amounts → `dark` text on `white` background

---

## Typography Scale

```typescript
// src/constants/typography.ts
export const Typography = {
  display:   { fontSize: 34, fontWeight: '700', lineHeight: 41 },  // dashboard total only
  title1:    { fontSize: 28, fontWeight: '700', lineHeight: 34 },  // screen titles
  title2:    { fontSize: 22, fontWeight: '600', lineHeight: 28 },  // section headers
  title3:    { fontSize: 20, fontWeight: '600', lineHeight: 25 },  // card titles
  body:      { fontSize: 17, fontWeight: '400', lineHeight: 22 },  // primary body text
  callout:   { fontSize: 16, fontWeight: '400', lineHeight: 21 },  // secondary body
  subhead:   { fontSize: 15, fontWeight: '400', lineHeight: 20 },  // metadata, hints
  footnote:  { fontSize: 13, fontWeight: '400', lineHeight: 18 },  // timestamps, fine print
  caption:   { fontSize: 12, fontWeight: '400', lineHeight: 16 },  // labels, chips
  mono:      { fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }, // token codes, amounts
} as const;
```

---

## Spacing System (4pt base grid)

```typescript
// src/constants/spacing.ts
export const Spacing = {
  xs:   4,   // icon padding, tight inline gaps
  sm:   8,   // between related elements
  md:   12,  // component internal padding
  base: 16,  // standard screen horizontal padding — use this everywhere
  lg:   20,  // card padding
  xl:   24,  // section separation
  xxl:  32,  // major section gaps
  xxxl: 48,  // screen-level breathing room
} as const;

export const SCREEN_PADDING = Spacing.base; // horizontal padding for all screens
```

**Never use odd numbers or values not on the 4pt grid.** If a design calls for 14px, use 12 or 16.

---

## Component Standards

| Component | iOS height | Android height | Border radius | Notes |
|---|---|---|---|---|
| Primary button | 50pt | 56dp | 12pt (iOS) / 28dp pill (Android) | Full width in forms |
| Secondary button | 44pt | 48dp | Same as primary | Outlined, no fill |
| Input field | 48pt | 56dp | 10pt / 4dp | Outlined style |
| Bottom sheet handle | — | — | 16pt top corners | Drag indicator required |
| Card | auto | auto | 12pt | Shadow iOS / Elevation 1 Android |
| List row | 56pt min | 56dp min | 0 | Separator at left inset 16pt |
| Avatar | 36pt | 36dp | 18pt (circle) | Show initials as fallback |
| Tab bar | 83pt (with safe area) | 80dp | — | 4 tabs only |
| FAB | 56pt | 56dp | 16pt | Bottom-right, above tab bar |

---

## Platform Rules (apply in every component)

```typescript
import { Platform } from 'react-native';

// Font weight
const fontWeight = Platform.OS === 'ios' ? '600' : 'bold';

// Haptics — iOS only, never crash on Android
import * as Haptics from 'expo-haptics';
const triggerHaptic = () => {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

// Shadows
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
});

// Bottom sheet snap points
const snapPoints = Platform.OS === 'ios' ? ['50%', '85%'] : ['45%', '80%'];

// Date picker — never use inline picker cross-platform
// iOS: Modal DateTimePicker / Android: Native DatePickerAndroid dialog
```

---

## Navigation Architecture

**4 bottom tabs** (in order):

| Tab | Icon | Route | Badge |
|---|---|---|---|
| Home | house.fill | `/(app)/` | Unsettled count |
| Expenses | list.bullet | `/(app)/expenses/` | — |
| Bills | repeat | `/(app)/bills/` | Overdue count |
| Household | person.2.fill | `/(app)/household/` | — |

**Route map** (all 16 routes):

```
(auth)/sign-in                  Magic link screen
(auth)/join/[token]             Household invite deep link

(app)/index                     Dashboard
(app)/expenses/index            Expense feed
(app)/expenses/add              Add expense (bottom sheet)
(app)/expenses/[id]             Expense detail
(app)/bills/index               Bills list
(app)/bills/add                 Add/edit bill (bottom sheet)
(app)/bills/[id]                Bill detail
(app)/household/index           Members list + household settings
(app)/household/invite          Show invite QR + deep link
(app)/household/move-out/[id]   Move-out flow (multi-step)
(app)/household/settle/[id]     Settle up with member
(app)/paywall                   Pro upgrade screen

(modals)/confirm-delete         Reusable delete confirmation
(modals)/error                  Full-screen error with retry
```

---

## Screen Specs (critical paths)

**Dashboard (`/`):**
- Top: Household name + billing cycle date range
- Center: Large balance display — "You are owed $X.XX" or "You owe $X.XX"
- Below: Per-member balance list (avatar + name + amount)
- FAB: Quick-add expense
- Empty state: "No expenses yet — tap + to add your first one"

**Add Expense (`/expenses/add`) — target < 10 seconds:**
1. Amount field (auto-focused, numeric keyboard, currency-formatted)
2. Description field (one-line text)
3. Paid by (defaults to current user — tap to change)
4. Split (defaults to equal among all members — tap to customize)
5. "Add" button
- No categories, no receipts, no notes in MVP
- Present as bottom sheet with 85% snap point

**Bills List (`/bills`):**
- Section headers: "Recurring Bills" and "One-time"
- Each row: Bill name + amount + frequency + next due date
- Overdue bills pinned to top with amber background
- FAB to add new bill
- Empty state: "No bills yet — add your first recurring bill"

**Paywall (`/paywall`):**
- Trigger: 3rd member OR 3rd bill
- Show: current usage vs limit clearly
- Price: $3.99/month per household
- One CTA: "Upgrade to Pro"
- Never show paywall more than once per session

---

## Accessibility Requirements

Every component must satisfy:

```typescript
// Minimum touch target — wrap small elements
<Pressable
  style={{ minWidth: 44, minHeight: 44 }}
  accessible={true}
  accessibilityLabel="Delete expense"
  accessibilityRole="button"
>

// Color is never the only indicator — always pair with text or icon
// ❌ Bad: red text alone means "you owe"
// ✓ Good: red text + "You owe" label

// Dynamic Type support — never hardcode font sizes in StyleSheet
// Use the Typography scale constants above, not raw numbers

// Contrast ratios (WCAG AA):
// Normal text (< 18pt): 4.5:1 minimum
// Large text (≥ 18pt bold): 3:1 minimum
// mid (#6B7280) on white (#FFFFFF) = 5.74:1 ✓
// light (#9CA3AF) on white = 2.85:1 ✗ — only use for decorative text
```

---

## Empty States

| Screen | Icon | Headline | Subtext | CTA |
|---|---|---|---|---|
| Dashboard | house | "Your household is set up!" | "Add your first expense to get started" | + Add Expense |
| Expense Feed | list.bullet | "No expenses yet" | "Tap + to add the first one" | + Add |
| Bills | repeat | "No recurring bills" | "Add rent, utilities, and subscriptions" | + Add Bill |
| Household | person.2 | "Just you so far" | "Invite roommates to split costs" | Invite |
| Settle Up | checkmark.circle | "All settled up!" | "No outstanding balances" | — |
| Move-Out | arrow.right.square | "No move-outs pending" | "Use this when a roommate leaves" | — |

---

## Error Handling

| Error | User-facing message | Recovery action |
|---|---|---|
| Network offline | "No internet — changes saved locally" | Auto-retry on reconnect |
| Expense add fails | "Couldn't save expense. Try again." | Retry button |
| Auth link expired | "That link has expired. Request a new one." | Re-enter email |
| Invite token invalid | "This invite link isn't valid or has expired." | Contact household member |
| Subscription check fails | "Couldn't verify subscription. Using cached status." | Refresh button |
| Split doesn't equal 100% | "Split amounts must add up to $X.XX" | Inline, real-time |
| Member already in household | "This person is already in your household." | Dismiss |

---

## AI Code Generation Rules for UI

When generating component code, always:

1. **Import colors from constants** — `import { Colors } from '@/constants/colors'`, never raw hex
2. **Import spacing from constants** — `import { Spacing } from '@/constants/spacing'`, never raw numbers
3. **Use Platform.select or Platform.OS** for any value that differs between iOS and Android
4. **Add accessibilityLabel and accessibilityRole** to all interactive elements
5. **Handle loading and error states** — every screen that fetches data needs both
6. **Use `useQuery` from TanStack** for data fetching, never raw `useEffect` + `fetch`
7. **Keep components under 150 lines** — extract sub-components if they grow beyond this
8. **Bottom sheets use `@gorhom/bottom-sheet`** — not Modal, not View positioned absolute
9. **Currency amounts** — always format with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`, never template literals
10. **Never use inline styles for layout** — always StyleSheet.create or a constants import
