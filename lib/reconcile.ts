import { RawFlags } from "./parse";

/**
 * The common shape every data source (legacy wide-column terms, the new
 * Status Log, or a static historical snapshot) is normalized into before
 * reconciliation/aggregation. This is what keeps aggregate.ts and the
 * page components ignorant of where the data actually came from.
 */
export type ReconcilableStudent = {
  admissionNo: string;
  name: string;
  courseCode: string;
  courseName: string;
  gender: string;
  contacts: string;
  intakeYear: string;
  campus: "MAIN" | "NAKURU";
  flags: RawFlags;
};

/**
 * A student's raw status flags are recorded as 8 independent columns and are
 * NOT mutually exclusive in the source sheet — a student can be marked
 * "Dropped" and "Reported" at once, for example. To get numbers that sum
 * cleanly to the roll, we pick ONE canonical status per student using the
 * precedence order below (first match wins).
 *
 * This order is a proposed default — adjust it to match how the registrar's
 * office actually wants conflicting cases resolved.
 */
export const PRECEDENCE: (keyof RawFlags)[] = [
  "dropped",
  "graduation",
  "completed",
  "deferred",
  "attachment",
  "clinicals",
  "reported",
  "nyr",
];

export const STATUS_LABEL: Record<keyof RawFlags, string> = {
  graduation: "Graduated",
  reported: "In Session",
  attachment: "Attachment",
  clinicals: "Clinicals",
  deferred: "Deferred",
  dropped: "Dropped",
  completed: "Completed",
  nyr: "Not Yet Reported",
};

export const LABEL_TO_FLAG: Record<string, keyof RawFlags> = Object.fromEntries(
  (Object.entries(STATUS_LABEL) as [keyof RawFlags, string][]).map(([k, v]) => [v, k])
) as Record<string, keyof RawFlags>;

/**
 * The Deferment App writes a more specific reason than plain "Deferred" —
 * e.g. "Attachment Deferment - Approved" rather than just "Deferred". On
 * the legacy MAIN/NAKURU CAMPUS tabs this doesn't matter: readFlags() only
 * checks whether the Deferred column is non-blank, any text counts. The
 * Status Log is different — it matches on the exact status TEXT, so
 * without this, any of these three strings would go unrecognized (silently
 * counted as Unmarked instead of Deferred). Add any future deferment-type
 * label the Deferment App introduces here — the raw text is still shown
 * verbatim on the student's own profile page, this only affects how it's
 * bucketed for counting.
 */
Object.assign(LABEL_TO_FLAG, {
  "Semester Deferment - Approved": "deferred",
  "Attachment Deferment - Approved": "deferred",
  "Maternity Leave - Approved": "deferred",
} satisfies Record<string, keyof RawFlags>);

/**
 * Once a student is Graduated or Dropped, that's treated as final — no
 * further status change is allowed without an explicit override. Enforced
 * at write time (see lib/writeStatus.ts), not here; this list is the single
 * source of truth for which statuses count as terminal.
 */
export const TERMINAL_STATUSES: (keyof RawFlags)[] = ["graduation", "dropped"];

export type Reconciled = {
  canonicalStatus: keyof RawFlags | "UNMARKED";
  setFlags: (keyof RawFlags)[];
  hasConflict: boolean;
};

export function reconcile(flags: RawFlags): Reconciled {
  const setFlags = (Object.keys(flags) as (keyof RawFlags)[]).filter(
    (k) => flags[k]
  );
  const canonicalStatus =
    PRECEDENCE.find((key) => flags[key]) ?? "UNMARKED";
  return {
    canonicalStatus,
    setFlags,
    hasConflict: setFlags.length > 1,
  };
}

export type ConflictRow = {
  admissionNo: string;
  name: string;
  courseCode: string;
  campus: string;
  contacts: string;
  setStatuses: string[];
  resolvedTo: string;
};

export function buildConflictReport(students: ReconcilableStudent[]): ConflictRow[] {
  const rows: ConflictRow[] = [];
  for (const s of students) {
    const r = reconcile(s.flags);
    if (r.hasConflict) {
      rows.push({
        admissionNo: s.admissionNo,
        name: s.name,
        courseCode: s.courseCode,
        campus: s.campus,
        contacts: s.contacts,
        setStatuses: r.setFlags.map((f) => STATUS_LABEL[f]),
        resolvedTo:
          r.canonicalStatus === "UNMARKED"
            ? "Unmarked"
            : STATUS_LABEL[r.canonicalStatus],
      });
    }
  }
  return rows;
}
