---
description: "Use when writing tests, setting up Jest, creating test files, or deciding what to test. Covers test priorities, Jest config, and patterns for unit tests, RLS integration tests, and component tests."
applyTo: "**/*.test.ts, **/*.test.tsx, jest.config.*"
---

# Testing Rules

## MVP Priorities
- **P1 (non-negotiable):** 100% coverage on `utils/debts.ts`, `utils/splits.ts`, `utils/proration.ts`
- **P2 (before launch):** Integration test RLS policies with local Supabase
- **P3 (only if complex):** Component tests for conditional UI logic (e.g., paywall gate)
- **Skip:** snapshot tests, E2E, navigation tests, every UI component

## Jest Config
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*)',
  ],
}
```

## Money Math Tests — Key Assertions
- Splits always sum exactly to total: `splits.reduce((sum, s) => sum + s.amount_owed, 0)` must equal amount
- Rounding remainder goes to first member
- Handle edge cases: $0 expense, single member, mutual debts canceling out
- Use `toBeCloseTo(value, 2)` for floating point comparisons

## RLS Integration Tests
- Run against local Supabase (`npx supabase start`)
- Create separate clients for different test users
- Verify: member cannot read another household's data (returns empty, not error)

## Component Tests
- Only for conditional rendering logic hard to verify by eye
- Use `@testing-library/react-native` with `render` and `fireEvent`
- Don't write snapshot tests — they break constantly with no value

## What NOT to Test
| Skip | Why |
|---|---|
| Snapshot tests | High maintenance, zero safety value |
| E2E (Detox/Maestro) | Overkill for solo dev pre-launch |
| Navigation flows | Trust Expo Router |
| Every UI component | See rendering bugs in simulator |
| Supabase SDK results | Test your logic, not their library |

## Commands
```bash
npx jest                        # All tests
npx jest utils/debts.test.ts    # Specific file
npx jest --watch                # Watch mode
npx jest --coverage             # Coverage report
```

See `docs/testing.md` for full example test files and RLS test setup.
