---
description: "Use when writing Supabase queries, mutations, hooks, RLS policies, Edge Functions, migrations, or auth logic. Covers query patterns, mutation patterns, RLS rules, and Supabase client conventions."
applyTo: "hooks/**, lib/supabase.ts, lib/config.ts, supabase/**"
---

# Supabase Patterns

## Client Setup
- Use `expo-secure-store` for auth session storage — never AsyncStorage
- Use the `Database` type from `@/types/database` for typed queries
- Never use service role key client-side — always query through RLS

## Query Hooks (TanStack React Query)
- Always add `enabled: !!someId` when the ID might be undefined
- Use `queryKey` arrays: `['expenses', householdId, cycleId]`
- Throw on Supabase error so React Query can catch it

```typescript
export function useExpenses(householdId: string, cycleId: string) {
  return useQuery({
    queryKey: ['expenses', householdId, cycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, paid_by_member:members(*), expense_splits(*)')
        .eq('household_id', householdId)
        .eq('cycle_id', cycleId)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!householdId && !!cycleId,
  })
}
```

## Mutations
- Always invalidate related queries in `onSuccess`
- Use `.select().single()` on inserts to return the created row

```typescript
const addExpense = useMutation({
  mutationFn: async (input: AddExpenseInput) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...input })
      .select()
      .single()
    if (error) throw error
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expenses', householdId] })
    queryClient.invalidateQueries({ queryKey: ['balances', householdId] })
  },
})
```

## Member Queries
- Always filter active members with `left_at IS NULL` — never delete member rows
- `members.user_id` is nullable (invite-only members)

## Migrations
- Live in `supabase/migrations/` as numbered SQL files
- Never edit a migration that has already been applied — create a new one
- Push to dev first, test, then promote to prod
- Never run `supabase db reset` on prod

## Forbidden Patterns
```typescript
// ❌ Service role key client-side
const supabase = createClient(url, SERVICE_ROLE_KEY)

// ❌ AsyncStorage for auth
auth: { storage: AsyncStorage }

// ❌ Missing enabled flag
useQuery({ queryKey: ['x', id], queryFn: fn })  // id might be undefined
```
