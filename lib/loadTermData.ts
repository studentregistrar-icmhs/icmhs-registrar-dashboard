import fs from "fs/promises";
import path from "path";
import { getTerm } from "./terms";
import { fetchSheetRows } from "./googleSheets";
import { parseCampusRows, toReconcilable } from "./parse";
import { buildFromStatusLog } from "./statusLog";
import { buildDashboardData, DashboardData } from "./aggregate";
import { buildConflictReport, ConflictRow } from "./reconcile";

export type TermData = {
  dashboard: DashboardData;
  conflicts: ConflictRow[];
  isLive: boolean;
  /** Set when this term's data source isn't ready yet (e.g. a tab that
   * hasn't been created). The page renders a friendly notice instead of
   * a build-breaking crash when this is present. */
  error?: string;
};

const EMPTY_DASHBOARD: DashboardData = {
  generatedAt: new Date().toISOString(),
  totals: { main: 0, nakuru: 0, all: 0 },
  statusCounts: { all: {}, main: {}, nakuru: {} },
  genders: { all: {}, main: {}, nakuru: {} },
  programs: [],
  studentsByStatus: {},
  conflictCount: 0,
};

export async function loadTermData(slug: string): Promise<TermData | null> {
  const term = getTerm(slug);
  if (!term) return null;

  try {
    if (term.source.kind === "live-legacy") {
      const [mainRows, nakuruRows] = await Promise.all([
        fetchSheetRows("MAIN CAMPUS!A:Z"),
        fetchSheetRows("NAKURU CAMPUS!A:X"),
      ]);
      const students = [
        ...parseCampusRows(mainRows, "MAIN"),
        ...parseCampusRows(nakuruRows, "NAKURU"),
      ];
      const reconcilable = toReconcilable(students, term.source.block);
      return {
        dashboard: buildDashboardData(reconcilable),
        conflicts: buildConflictReport(reconcilable),
        isLive: true,
      };
    }

    if (term.source.kind === "live-statuslog") {
      const [mainRows, nakuruRows, logRows] = await Promise.all([
        fetchSheetRows("MAIN CAMPUS!A:Z"),
        fetchSheetRows("NAKURU CAMPUS!A:X"),
        fetchSheetRows("STATUS LOG!A:D"),
      ]);
      const roster = [
        ...parseCampusRows(mainRows, "MAIN"),
        ...parseCampusRows(nakuruRows, "NAKURU"),
      ];
      const reconcilable = buildFromStatusLog(roster, logRows, term.source.termLabel);
      return {
        dashboard: buildDashboardData(reconcilable),
        conflicts: buildConflictReport(reconcilable),
        isLive: true,
      };
    }

    // static historical snapshot — pre-parsed JSON, no live fetch
    const filePath = path.join(process.cwd(), "data", "historical", term.source.file);
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return { dashboard: parsed.dashboard, conflicts: parsed.conflicts ?? [], isLive: false };
  } catch (err: any) {
    // Common cause: a sheet tab this term depends on (e.g. "STATUS LOG")
    // doesn't exist yet. Don't crash the build/page — surface it instead.
    return {
      dashboard: EMPTY_DASHBOARD,
      conflicts: [],
      isLive: term.source.kind !== "static",
      error: err?.message ?? "Failed to load data for this term.",
    };
  }
}
