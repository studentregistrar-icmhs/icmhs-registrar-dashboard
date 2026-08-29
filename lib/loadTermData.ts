import fs from "fs/promises";
import path from "path";
import { getTerm } from "./terms";
import { fetchSheetRows } from "./googleSheets";
import { parseCampusRows, toReconcilable } from "./parse";
import { buildFromStatusLog } from "./statusLog";
import { buildDashboardData, DashboardData } from "./aggregate";
import { buildConflictReport, ConflictRow } from "./reconcile";

export type TermData = { dashboard: DashboardData; conflicts: ConflictRow[]; isLive: boolean };

export async function loadTermData(slug: string): Promise<TermData | null> {
  const term = getTerm(slug);
  if (!term) return null;

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
}
