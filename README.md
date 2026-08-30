# ICMHS Registrar Dashboard

A multi-term, live-updating student-population dashboard for the
Registrar's Office — reads and writes back to the same Google Sheet the
deferment app uses, with per-student status editing, CSV exports, a
term-over-term trend comparison, and a password gate.

## Feature summary

- **Multi-term routing** — each term lives at `/terms/<slug>`, config-driven
  from `lib/terms.ts`. Jan-Apr and May-Aug read live from legacy wide-column
  blocks; Sept-Dec onward reads from a new single-column Status Log tab;
  future years can be added as static JSON snapshots.
- **Global student search** — a search box in every term page's header
  (filters already-loaded data instantly) plus a standalone `/students`
  page (server-searches on demand, works without picking a term first).
- **Student profile & timeline** (`/students/[admissionNo]`) — see a
  student's status across every term, and edit it inline.
- **Write-back to the Sheet** — updating a student's status, or hitting
  "Resolve" on a Data Quality conflict, writes directly to the Google
  Sheet (see "Write-back architecture" below).
- **Terminal status lock** — once a student is Graduated or Dropped in any
  live term, further status changes are blocked unless explicitly
  overridden (surfaced as a confirmation modal, not a silent failure).
- **Data Quality tab** — Conflicting Status Flags (multiple columns marked)
  and Unmarked Students (none marked), each with CSV export and a "Clean
  Records %" summary.
- **Term-over-term trend card** — compares the current term's canonical
  status counts against the immediately preceding term (`getPreviousTerm()`
  in `lib/terms.ts`).
- **Drill-down** — click any KPI card or ledger row to see the actual list
  of students in that status, with CSV export.
- **Auto-refresh** — live terms auto-refresh every 3 minutes (pausable),
  plus a manual "Refresh now" button; the header shows a relative
  "updated Xm ago" timestamp.
- **Password gate** (`middleware.ts`) — HTTP Basic Auth in front of every
  page and API route. Fails **closed**: if `DASHBOARD_PASSWORD` isn't set,
  requests are rejected rather than let through.

## Architecture

- **`lib/terms.ts`** — term registry + `getPreviousTerm()` for the trend card.
- **`lib/parse.ts`** — roster + flag parsing (`parseCampusRows`,
  `toReconcilable`), plus `readFlagsAt()` / `LAYOUT_FOR_WRITE` used by the
  write path to compute exact cell ranges.
- **`lib/reconcile.ts`** — canonical-status precedence, `STATUS_LABEL`,
  `LABEL_TO_FLAG`, and `TERMINAL_STATUSES` (`["graduation", "dropped"]`).
- **`lib/statusLog.ts`** — parses the Sept-Dec+ Status Log tab; each
  student gets exactly one status, so this path can't produce a conflict.
- **`lib/aggregate.ts`** — builds one term's dashboard data, including
  `studentsByStatus` (powers both the drill-down panel and the Unmarked
  Students view) and `conflictCount`.
- **`lib/loadTermData.ts`** — branches on a term's `source.kind`; catches
  errors gracefully (e.g. Status Log tab not created yet) instead of
  crashing the build.
- **`lib/googleSheets.ts`** — full read/write scope; `fetchSheetRows()`,
  `updateRange()`, `appendRow()`.
- **`lib/rosterLookup.ts`** — finds a student's exact sheet row by
  admission number (needed for targeted writes).
- **`lib/writeStatus.ts`** — the write path:
  - `updateStudentStatus()` — sets a student's status for a term; checks
    every live term for an existing terminal status first, refuses unless
    `override: true`.
  - `resolveLegacyConflict()` — clears redundant flag columns, keeping only
    the canonical one.
- **`lib/studentTimeline.ts`** — read-only cross-term lookup for a student.
- **`lib/csv.ts`** — dependency-free CSV builder + browser download trigger.
- **`middleware.ts`** — the password gate.

## Write-back architecture

Two different write shapes, matching how each term stores data:

- **Legacy terms** (Jan-Apr, May-Aug): `updateStudentStatus()` finds the
  student's row via `lib/rosterLookup.ts`, then overwrites that term's
  8-column block with the new status in the correct column and `"-"`
  everywhere else. `resolveLegacyConflict()` does the same but derives the
  target status from whichever flag already wins on precedence.
- **Status Log terms** (Sept-Dec+): `updateStudentStatus()` appends a new
  row to the `STATUS LOG` tab (matches the append-only design — never
  edits old rows).
- Static historical terms are read-only; both write paths return
  `unsupported-term` for them.

Every write re-checks the terminal lock first unless `override: true` is
explicitly passed — this happens both from the student profile page and
from the Data Quality "Resolve" button (which always passes `override:
true` internally, since resolving a conflict isn't "changing away from" a
status).

## Password gate

Set `DASHBOARD_PASSWORD` (and optionally `DASHBOARD_USER`, defaults to
`registrar`) in Vercel's Environment Variables. `middleware.ts` protects
every route with HTTP Basic Auth and **fails closed** — if the password
isn't set, the dashboard returns an error instead of serving content
unauthenticated.

This is intentionally simple (no accounts, no audit trail of *who* made a
given change) — fine for a small internal team sharing one password. If
per-user accountability ever matters (e.g. "who marked this student
Dropped"), that's a bigger addition.

## Setting up Sept–Dec 2026 (the Status Log)

1. Add a tab named exactly `STATUS LOG` with header row:
   `Admission No. | Term | Status | Date Updated`.
2. Add Data Validation on the Status column (Reject input) restricted to:
   ```
   Graduated, In Session, Attachment, Clinicals, Deferred, Dropped, Completed, Not Yet Reported
   ```
   (Not "NYR" — must match `STATUS_LABEL` in `lib/reconcile.ts` exactly.)
3. Staff append one row per status change, `Term` set to `SEPT-DEC 2026`
   (must match `termLabel` in `lib/terms.ts`). Never edit old rows.
4. `/terms/sept-dec-2026` picks this up automatically once the tab exists
   — no redeploy needed (it currently shows a friendly "not set up yet"
   page instead of erroring).

## Google service account scope

Needs full `spreadsheets` scope now, not `.readonly`. Since the deferment
app already writes to column W using these same credentials, it almost
certainly already has Editor access on this sheet — no Google Cloud
changes should be needed, just redeploy.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # http://localhost:3000
```

Required env vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
`GOOGLE_SHEET_ID`, `DASHBOARD_PASSWORD`. Optional: `REVALIDATE_SECONDS`
(default 120), `DASHBOARD_USER` (default `registrar`).

## Deploying to Vercel

```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin <your GitHub repo URL>
git push -u origin main
```

Vercel → Add New → Project → import the repo → add the env vars above →
Deploy.

## Adding a previous year

See `data/historical/README.md`. Static historical terms are read-only —
the student timeline currently only covers live terms; extending it to
include historical years is straightforward once a static snapshot
includes a per-student index.

## Column layout reference (legacy terms)

See `lib/parse.ts`'s `LAYOUT` constant. Each 8-column block is:
Graduation, Reported, Attachment, Clinicals, Deferred, Dropped, Completed,
NYR.
