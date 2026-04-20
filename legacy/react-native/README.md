# Legacy React Native source

This directory contains the original React Native + Expo implementation of
Homesplit. It is preserved as a **behavioral specification** for the native
iOS port living in the repository root.

## Rules

- **Do not extend this tree.** No new features, no refactors, no bug fixes.
- Bug fixes that also affect the iOS app land in the iOS client and (when
  relevant) in the shared Supabase backend at `../../supabase/`.
- If a behavior question arises during the iOS port ("what does the
  dashboard show when there's no cycle?"), the answer is whatever the
  code in this directory does.

## Removal plan

See `../../.claude/docs/ios/migration-plan.md` § "Decommissioning the React
Native source". Short version: once `../../IOS_MIGRATION.md` is fully green
and the iOS app ships, this tree is tagged `legacy-rn-v1`, moved to a frozen
branch `legacy/react-native`, and deleted from `main`.
