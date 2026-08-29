import { RawFlags } from "./parse";
import { ReconcilableStudent } from "./reconcile";

/**
 * Expected shape of the new "STATUS LOG" tab, one row per status entry:
 *   Admission No. | Term | Status | Date Updated
 * e.g.  2024/1234 | SEPT-DEC 2026 | In Session | 2026-09-05
 *
 * Status should be a Data-Validation dropdown restricted to exactly these
 * labels (see README) so this mapping never sees anything unexpected:
 */
const LABEL_TO_FLAG: Record<string, keyof RawFlags> = {
  Graduated: "graduation",
  "In Session": "reported",
  Attachment: "attachment",
  Clinicals: "clinicals",
  Deferred: "deferred",
  Dropped: "dropped",
  Completed: "completed",
  NYR: "nyr",
};

const EMPTY_FLAGS: RawFlags = {
  graduation: false, reported: false, attachment: false, clinicals: false,
  deferred: false, dropped: false, completed: false, nyr: false,
};

function flagsFromLabel(label: string): RawFlags {
  const key = LABEL_TO_FLAG[label.trim()];
  if (!key) return { ...EMPTY_FLAGS }; // unrecognized/blank -> Unmarked, not a conflict
  return { ...EMPTY_FLAGS, [key]: true };
}

type Roster = { admissionNo: string; name: string; courseCode: string; courseName: string; gender: string; campus: "MAIN" | "NAKURU" }[];

/**
 * Builds ReconcilableStudent[] for a Status-Log-based term by joining the
 * roster (MAIN/NAKURU CAMPUS, unchanged) against the log rows for that term.
 * If the same admission no. has multiple log rows for the term (shouldn't
 * happen if staff append rather than duplicate), the LATEST row by sheet
 * order wins — still a single canonical status, no conflict possible.
 */
export function buildFromStatusLog(
  roster: Roster,
  logRows: any[][],
  termLabel: string
): ReconcilableStudent[] {
  // logRows[0] is assumed to be the header row: Admission No | Term | Status | Date Updated
  const latestStatusByAdmission = new Map<string, string>();
  for (let i = 1; i < logRows.length; i++) {
    const [admissionNo, term, status] = logRows[i] ?? [];
    if (!admissionNo || String(term).trim() !== termLabel) continue;
    latestStatusByAdmission.set(String(admissionNo), String(status ?? ""));
  }

  return roster.map((r) => ({
    admissionNo: r.admissionNo,
    name: r.name,
    courseCode: r.courseCode,
    courseName: r.courseName,
    gender: r.gender,
    campus: r.campus,
    flags: flagsFromLabel(latestStatusByAdmission.get(r.admissionNo) ?? ""),
  }));
}
