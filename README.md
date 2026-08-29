# ICMHS Registrar Dashboard

A multi-term student-population dashboard. Each term lives at its own
URL (`/terms/<slug>`), and the term list on `/` is generated from a
single config file — adding a new term never requires touching page
logic.

## Architecture

- **`lib/terms.ts`** — the term registry. Each entry says where that
  term's data comes from:
  - `live-legacy` — a term still stored as wide status columns in the
    `MAIN CAMPUS` / `NAKURU CAMPUS` Google Sheet tabs (Jan–Apr 2026,
    May–Aug 2026). Read live on every page load.
  - `live-statuslog` — a term using the new single-column `STATUS LOG`
    tab (Sept–Dec 2026 onward). Also read live.
  - `static` — a previous year's term, parsed once from an uploaded
    Excel file into a JSON snapshot under `data/historical/`. Never
    fetched live.
- **`lib/parse.ts`** — turns raw `MAIN CAMPUS`/`NAKURU CAMPUS` rows into
  `Student` records (roster + both legacy flag blocks), plus
  `toReconcilable()` to pick one block for a given term.
- **`lib/statusLog.ts`** — turns the new `STATUS LOG` tab into the same
  shape, for Sept–Dec 2026 onward. Each student gets exactly one status,
  so this path can never produce a conflict.
- **`lib/reconcile.ts`** — resolves multiple flags (only possible in
  `live-legacy` terms) into one canonical status via a precedence order,
  and reports any that had to be resolved.
- **`lib/aggregate.ts`** — builds one term's dashboard data (totals,
  gender split, per-programme rollup) from its normalized student list.
  Source-agnostic — doesn't know or care where the students came from.
- **`lib/loadTermData.ts`** — the one place that branches on a term's
  `source.kind` and calls the right combination of the above. Used by
  both `app/terms/[term]/page.tsx` and the refresh API route.
- **`app/terms/[term]/page.tsx`** — the actual dashboard page for one
  term.
- **`app/page.tsx`** — landing page listing every term in `lib/terms.ts`.
- **`app/api/terms/[term]/route.ts`** — powers the "Refresh now" button
  (forces an immediate re-pull instead of waiting for the scheduled
  revalidation).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local`, filling in the same service
   account credentials `icmhsdeferment` already uses on Vercel
   (read-only scope is enough here):
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_PRIVATE_KEY="..."
   GOOGLE_SHEET_ID=...
   REVALIDATE_SECONDS=120
   ```
3. `npm run dev` → http://localhost:3000

(No local Node? See the "install-free" deployment path — extract the
zip, upload the folder to a new GitHub repo via the browser, then import
into Vercel. Vercel builds it in the cloud; you never need Node locally.)

## Setting up Sept–Dec 2026 (the new Status Log)

1. In the same Google Sheet, add a tab named exactly `STATUS LOG` with
   header row: `Admission No. | Term | Status | Date Updated`.
2. On the Status column, add Data Validation (Data → Data validation)
   restricted to a dropdown with exactly these values, "Reject input"
   on invalid entries:
   ```
   Graduated, In Session, Attachment, Clinicals, Deferred, Dropped, Completed, NYR
   ```
3. Registrar staff add one new row per status change, with `Term` set
   to `SEPT-DEC 2026` (must match `termLabel` in `lib/terms.ts` exactly).
   Never edit old rows — always append.
4. That's it — `/terms/sept-dec-2026` is already wired up to read this
   tab once it exists.

## Adjusting the status precedence (legacy terms only)

Open `lib/reconcile.ts` and reorder `PRECEDENCE`. Only matters for
`live-legacy` terms — Status-Log-based terms can't have conflicts by
construction.

## Adding a previous year

See `data/historical/README.md`. Short version: send the workbook to
Claude, drop the resulting JSON into `data/historical/`, add one entry
to `lib/terms.ts`. No other code changes needed.

## Column layout reference (legacy terms)

If the sheet's column order ever changes, update `LAYOUT` in
`lib/parse.ts`. Current mapping (0-indexed from column A):

| Field          | MAIN CAMPUS | NAKURU CAMPUS |
|----------------|:-----------:|:-------------:|
| Admission No.  | B (1)       | B (1)         |
| Name           | C (2)       | C (2)         |
| Course Code    | D (3)       | D (3)         |
| Programme Name | E (4)       | E (4)         |
| Gender         | H (7)       | G (6)         |
| Jan–Apr block  | K–R (10–17) | I–P (8–15)    |
| May–Aug block  | S–Z (18–25) | Q–X (16–23)   |

Each block is 8 consecutive columns: Graduation, Reported, Attachment,
Clinicals, Deferred, Dropped, Completed, NYR.

## Deploying to Vercel

```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin <your GitHub repo URL>
git push -u origin main
```

Then in Vercel: Add New → Project → import the repo → add the three env
vars → Deploy.
