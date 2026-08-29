import { RawFlags, Student } from "./parse";

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

export function buildConflictReport(students: Student[]): ConflictRow[] {
  const rows: ConflictRow[] = [];
  for (const s of students) {
    const r = reconcile(s.flagsMayAug);
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
