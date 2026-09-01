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
  - `resolveLegacyConflict()` / `resolveLegacyConflictsBulk()` — clear
    redundant flag columns, keeping only the canonical one. Each logs a row
    to `RESOLVE LOG` (who, when, what it was before, what it became) before
    reporting success — see "Resolve log & password" below.
- **`lib/resolveAuth.ts`** — the second password gate, specific to resolving.
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

This is intentionally simple (no accounts, no per-page permissions) — fine
for a small internal team sharing one password for *viewing* the
dashboard. Resolving conflicts is a separate, higher-risk action and has
its own gate — see below.

## Resolve log & password

Clicking "Resolve" or "Resolve all" overwrites status columns directly in
the live sheet, so it gets its own protections, independent of the
dashboard password:

- **A second password.** Set `RESOLVE_PASSWORD` in Environment Variables —
  it must differ from `DASHBOARD_PASSWORD` in practice (nothing enforces
  that technically, but there's no point otherwise). `lib/resolveAuth.ts`
  checks it server-side on every resolve request and fails closed the same
  way the dashboard password does. Anyone with the dashboard password can
  browse and export; only someone who also has this one can resolve.
- **A name field.** The confirm dialog also asks for the resolver's name.
  This is self-attested, not real authentication — anyone can type any
  name — but paired with the log below it gives you something to go on
  when a mistake happens, which is more than nothing.
- **A `RESOLVE LOG` tab**, append-only like `STATUS LOG`. Every resolve —
  single or bulk — appends one row per student *before* reporting success
  to the browser, but only *after* the sheet write itself succeeds, so the
  log never claims a change happened that didn't. Columns: `Timestamp |
  Admission No. | Term | Previous Flags Set | Resolved To | Resolved By`.
  Create this tab the same way as `STATUS LOG` (see below) — until it
  exists, resolving will fail with a sheet error rather than silently
  skipping the log.
- **This is how you recover from a mistaken resolve.** There's no "undo"
  button — a resolve is a direct overwrite. But `RESOLVE LOG`'s "Previous
  Flags Set" column tells you exactly which columns to re-mark in the
  sheet to put a student back. For anything resolved *before* this log
  existed, your only option is Google Sheets' own Version History (File →
  Version history → See version history) — find the revision just before
  the incident and manually copy back the affected rows' values rather
  than restoring the whole version wholesale, which would also undo any
  legitimate edits made since.

## Setting up the RESOLVE LOG tab

1. Add a tab named exactly `RESOLVE LOG` with header row: `Timestamp |
   Admission No. | Term | Previous Flags Set | Resolved To | Resolved By`.
2. That's it — no data validation needed, this tab is machine-written only.
3. Set `RESOLVE_PASSWORD` in Vercel's Environment Variables if you haven't
   already (see `.env.example`). Resolving fails closed until it's set.

## Syncing inherited terminal statuses into the Status Log

Graduated/Dropped carries forward automatically from Jan–Apr/May–Aug into
any Status Log term — the dashboard, KPIs, and student profile page all
show it without anyone logging anything (see `inheritedTerminalFlags()` in
`lib/statusLog.ts`). That's enough for the app itself, but the raw
`STATUS LOG` sheet stays silent about it, which isn't great if someone
audits the sheet directly rather than the dashboard.

The **"Sync terminal statuses to log"** button (visible on any Status Log
term's dashboard, next to the filters) writes an explicit row —
`Admission No. | Term | Status | Date Updated | Auto-carried forward,
synced by <name>` — for every student whose terminal status is currently
only inferred, not logged. It's gated by the same `RESOLVE_PASSWORD` and
name prompt as resolving, and safe to click repeatedly: it only appends a
row for a student if their latest logged row for that term doesn't already
match, so re-running it after everyone's already synced does nothing.

Note the 5th column: `flagsFromLabel()` only reads the first 3 columns
positionally, so this extra "why" note doesn't interfere with normal
parsing — it's there purely so a human skimming the sheet can tell an
auto-synced row apart from one a staff member typed by hand.

## Setting up Sept–Dec 2026 (the Status Log)

1. Add a tab named exactly `STATUS LOG` with header row:
   `Admission No. | Term | Status | Date Updated`.
2. Add Data Validation on the Status column (Reject input) restricted to:
   ```
   Graduated, In Session, Attachment, Clinicals, Deferred, Dropped, Completed, Not Yet Reported,
   Semester Deferment - Approved, Attachment Deferment - Approved, Maternity Deferment - Approved
   ```
   The first 8 must match `STATUS_LABEL` in `lib/reconcile.ts` exactly (not
   "NYR" — "Not Yet Reported" spelled out). The last 3 are the Deferment
   App's specific deferral-reason labels — all three are recognized as
   "Deferred" for counting purposes (see `LABEL_TO_FLAG` in
   `lib/reconcile.ts`) while the exact reason still shows on the student's
   own profile page. If the Deferment App ever adds a new deferral type,
   add it to both this dropdown list and that mapping.
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
`GOOGLE_SHEET_ID`, `DASHBOARD_PASSWORD`, `RESOLVE_PASSWORD`. Optional:
`REVALIDATE_SECONDS`
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
