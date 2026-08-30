import { fetchSheetRows } from "./googleSheets";
import { findStudentRow } from "./rosterLookup";
import { readFlagsAt } from "./parse";
import { reconcile, STATUS_LABEL } from "./reconcile";
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
  campus: "MAIN" | "NAKURU";
  timeline: TimelineEntry[];
};

export async function getStudentTimeline(admissionNo: string): Promise<StudentProfile | null> {
  const loc = await findStudentRow(admissionNo);
  if (!loc) return null;

  const nameCol = 2;
  const courseCodeCol = 3;
  const courseNameCol = 4;

  const timeline: TimelineEntry[] = [];

  for (const term of TERMS) {
    if (term.source.kind === "live-legacy") {
      const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
      const r = reconcile(flags);
      timeline.push({
        termSlug: term.slug,
        termLabel: term.label,
        status: r.canonicalStatus === "UNMARKED" ? "Unmarked" : STATUS_LABEL[r.canonicalStatus],
        editable: true,
      });
    }
  }

  const statusLogTerm = TERMS.find((t) => t.source.kind === "live-statuslog");
  if (statusLogTerm) {
    const logRows = await fetchSheetRows("STATUS LOG!A:D").catch(() => []);
    let latestStatus: string | null = null;
    for (let i = 1; i < logRows.length; i++) {
      const [rowAdmission, term, status] = logRows[i] ?? [];
      if (String(rowAdmission) === admissionNo) latestStatus = String(status ?? "");
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
    campus: loc.campus,
    timeline,
  };
}
