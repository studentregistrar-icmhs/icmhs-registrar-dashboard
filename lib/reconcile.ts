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
