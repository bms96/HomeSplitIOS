---
description: "Use when building screens, components, layouts, styling, navigation, bottom sheets, or any UI work. Covers color tokens, typography, spacing, platform rules, accessibility, and component conventions."
applyTo: "components/**, app/**"
---

# UI/UX Rules

## Imports — Never Raw Values
```typescript
import { Colors } from '@/constants/colors'
import { Spacing } from '@/constants/spacing'
import { Typography } from '@/constants/typography'
```
Never use raw hex colors or magic numbers for spacing.

## Platform Handling
- Use `Platform.select()` or `Platform.OS` for any iOS/Android differences
- Haptics: iOS only (`if (Platform.OS === 'ios')`) — never crash on Android
- Shadows: `shadowColor/shadowOffset/shadowOpacity/shadowRadius` on iOS, `elevation` on Android

## Accessibility (every interactive element)
```typescript
<Pressable
  style={{ minWidth: 44, minHeight: 44 }}
  accessible={true}
  accessibilityLabel="Delete expense"
  accessibilityRole="button"
>
```
- Color is never the only indicator — always pair with text or icon
- WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text

## Component Rules
- One component per file
- Keep under 150 lines — extract sub-components beyond that
- Use `StyleSheet.create()` for all styles — no inline style objects
- Bottom sheets: use `@gorhom/bottom-sheet` — never Modal or absolute-positioned Views
- Currency: `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` — never template literals

## Data Fetching in Screens
- Use `useQuery` from TanStack — never raw `useEffect` + `fetch`
- Every data-fetching screen must handle loading and error states

## Navigation
```typescript
import { router } from 'expo-router'
router.push('/expenses/add')    // navigate
router.back()                    // go back
router.replace('/(app)')        // replace (no back stack)
```

## 4 Bottom Tabs (in order)
1. Home (`/(app)/`) — Unsettled count badge
2. Expenses (`/(app)/expenses/`)
3. Bills (`/(app)/bills/`) — Overdue count badge
4. Household (`/(app)/household/`)

## Semantic Colors
- Positive balance (owed to user) → `Colors.success` on `Colors.successBg`
- Negative balance (user owes) → `Colors.danger` on `Colors.dangerBg`
- Pending/unsettled → `Colors.warning` on `Colors.warningBg`

## Spacing (4pt grid only)
`xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48`
Never use odd numbers or values off the 4pt grid.

See `docs/ui-ux.md` for full color tokens, typography scale, component size standards, screen specs, empty states, and error messages.
