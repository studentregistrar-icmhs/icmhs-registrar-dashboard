# Historical term snapshots

Each file here is one term's pre-computed dashboard data — the direct
output of `lib/aggregate.ts` for that term, saved as JSON:

```json
{ "dashboard": { ...DashboardData... }, "conflicts": [ ...ConflictRow[]... ] }
```

To add a previous year: send the term's Excel workbook to Claude, which
parses it (reusing the same reconciliation logic as the live terms) and
produces one of these JSON files. Drop it in here, then add a matching
entry to `lib/terms.ts`:

```ts
{
  slug: "jan-apr-2025",
  label: "Jan – Apr 2025",
  source: { kind: "static", file: "jan-apr-2025.json" },
}
```

No code changes needed beyond that — the dynamic route and nav pick it
up automatically.
