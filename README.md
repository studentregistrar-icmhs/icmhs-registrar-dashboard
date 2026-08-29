# ICMHS Registrar Dashboard

A live student-population dashboard that reads directly from the same
Google Sheet (`MAIN CAMPUS` / `NAKURU CAMPUS` tabs) used by the
`icmhsdeferment` app. No re-uploading — any edit to the sheet shows up on
the next refresh.

## How it works

- `app/page.tsx` fetches both tabs server-side via the Google Sheets API
  on every request, revalidated at most every `REVALIDATE_SECONDS`
  (default 120s) using Next.js's built-in ISR.
- `lib/parse.ts` turns raw rows into typed `Student` records.
- `lib/reconcile.ts` resolves each student's status. The source sheet
  records 8 independent flag columns per student per term
  (Graduation / Reported / Attachment / Clinicals / Deferred / Dropped /
  Completed / NYR) that are **not mutually exclusive** — a student can
  have more than one marked. This file picks one canonical status per
  student using a precedence order (`PRECEDENCE` array), so the KPI and
  ledger numbers sum cleanly. **Adjust that order** if the registrar's
  office wants conflicts resolved differently.
- `lib/aggregate.ts` rolls reconciled students up into the shapes the
  dashboard renders (totals, per-programme counts, gender split, term
  trend).
- The "Data Quality" tab in the UI lists every student who had more than
  one flag set, so the source sheet can be cleaned up directly.
- The "Refresh now" button calls `POST /api/refresh` (forces
  revalidation) then re-fetches `/api/students` for an instant pull,
  without waiting for the scheduled interval.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables** — copy `.env.example` to `.env.local` and
   fill in the same service-account credentials already used by
   `icmhsdeferment` (Vercel → icmhsdeferment project → Settings →
   Environment Variables — copy the values across):

   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_PRIVATE_KEY="..."
   GOOGLE_SHEET_ID=...
   REVALIDATE_SECONDS=120
   ```

   The service account only needs **read** access
   (`spreadsheets.readonly` scope) — it does not need to be able to
   write, unlike the deferment app's credentials.

3. **Run locally**

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000

## Deploying to Vercel

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your new GitHub repo URL>
git push -u origin main
```

Then in Vercel:

1. "Add New… → Project" → import the GitHub repo.
2. Add the three env vars from step 2 above under
   Project Settings → Environment Variables.
3. Deploy. You'll get a `your-project-name.vercel.app` URL.

## Adjusting the status precedence

Open `lib/reconcile.ts` and reorder the `PRECEDENCE` array. The first
matching flag (top to bottom) wins for any student with multiple flags
set. Current default:

```
Dropped → Graduated → Completed → Deferred → Attachment → Clinicals → Reported → NYR
```

## Column layout reference

If the sheet's column order ever changes, update the `LAYOUT` constant
in `lib/parse.ts`. Current mapping (0-indexed from column A):

| Field          | MAIN CAMPUS | NAKURU CAMPUS |
|----------------|:-----------:|:-------------:|
| Admission No.  | B (1)       | B (1)         |
| Name           | C (2)       | C (2)         |
| Course Code    | D (3)       | D (3)         |
| Programme Name | E (4)       | E (4)         |
| Gender         | H (7)       | G (6)         |
| Jan–Apr block  | K–R (10–17) | I–P (8–15)    |
| May–Aug block  | S–Z (18–25) | Q–X (16–23)   |

Each "block" is 8 consecutive columns in the order: Graduation,
Reported, Attachment, Clinicals, Deferred, Dropped, Completed, NYR.

## Optional next step: historical trends

Right now "Jan–Apr vs May–Aug" is computed from the two term-blocks
already in the sheet. To get real historical trend lines beyond these
two terms, snapshot `buildDashboardData()`'s output into a database
(e.g. the same Neon Postgres used by icmhsdeferment) on a schedule
(Vercel Cron → hit `/api/students` daily/weekly and insert a row into a
`snapshots` table). Ask if you'd like this scaffolded too.
