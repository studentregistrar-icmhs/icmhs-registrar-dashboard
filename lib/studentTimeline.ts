import { fetchSheetRows } from "./googleSheets";
import { findStudentRow } from "./rosterLookup";
import { readFlagsAt, LAYOUT_FOR_WRITE } from "./parse";
import { reconcile, STATUS_LABEL, TERMINAL_STATUSES } from "./reconcile";
import { TERMS } from "./terms";

export type TimelineEntry = {
  termSlug: string;
  termLabel: string;
  status: string;
  editable: boolean; // false for static historical terms
};

export type StudentProfile = {
  admissionNo: string;
  name: string;
  courseCode: string;
  courseName: string;
  gender: string;
  contacts: string;
  intakeYear: string;
  campus: "MAIN" | "NAKURU";
  timeline: TimelineEntry[];
};

export async function getStudentTimeline(admissionNo: string): Promise<StudentProfile | null> {
  const loc = await findStudentRow(admissionNo);
  if (!loc) return null;

  const layout = LAYOUT_FOR_WRITE[loc.campus];
  const nameCol = layout.name;
  const courseCodeCol = layout.courseCode;
  const courseNameCol = layout.courseName;

  const timeline: TimelineEntry[] = [];
  // Most recent legacy terminal status found, checked in TERMS order so a
  // later term's Graduated/Dropped overrides an earlier one if somehow both
  // are set — carries forward into Status Log terms below, same as
  // buildFromStatusLog() does for the main dashboard.
  let inheritedTerminal: string | null = null;

  for (const term of TERMS) {
    if (term.source.kind === "live-legacy") {
      const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
      const r = reconcile(flags);
      const status = r.canonicalStatus === "UNMARKED" ? "Unmarked" : STATUS_LABEL[r.canonicalStatus];
      timeline.push({ termSlug: term.slug, termLabel: term.label, status, editable: true });
      if (r.canonicalStatus !== "UNMARKED" && TERMINAL_STATUSES.includes(r.canonicalStatus)) {
        inheritedTerminal = status;
      }
    }
  }

  const statusLogTerm = TERMS.find((t) => t.source.kind === "live-statuslog");
  if (statusLogTerm) {
    let latestStatus: string | null = null;
    if (inheritedTerminal) {
      // Terminal is final everywhere else in this app — it carries forward
      // even over a conflicting log row, since a terminal status shouldn't
      // have been logged over in the first place.
      latestStatus = inheritedTerminal;
    } else {
      const logRows = await fetchSheetRows("STATUS LOG!A:D").catch(() => []);
      for (let i = 1; i < logRows.length; i++) {
        const [rowAdmission, term, status] = logRows[i] ?? [];
        if (String(rowAdmission) === admissionNo) latestStatus = String(status ?? "");
      }
    }
    if (latestStatus !== null) {
      timeline.push({
        termSlug: statusLogTerm.slug,
        termLabel: statusLogTerm.label,
        status: latestStatus || "Unmarked",
        editable: true,
      });
    }
  }

  // Static historical terms would be added here once their JSON snapshots
  // include a per-student index — skipped for now (see data/historical/README.md).

  return {
    admissionNo,
    name: String(loc.rawRow[nameCol] ?? "").trim(),
    courseCode: String(loc.rawRow[courseCodeCol] ?? "").trim(),
    courseName: String(loc.rawRow[courseNameCol] ?? "").trim(),
    gender: String(loc.rawRow[layout.gender] ?? "").trim(),
    contacts: String(loc.rawRow[layout.contacts] ?? "").trim(),
    intakeYear: layout.intake !== undefined ? String(loc.rawRow[layout.intake] ?? "").trim() : "",
    campus: loc.campus,
    timeline,
  };
}
