import Dashboard from "@/components/Dashboard";
import { fetchSheetRows } from "@/lib/googleSheets";
import { parseCampusRows } from "@/lib/parse";
import { buildDashboardData } from "@/lib/aggregate";
import { buildConflictReport } from "@/lib/reconcile";

export const revalidate = Number(process.env.REVALIDATE_SECONDS ?? 120);

export default async function Page() {
  const [mainRows, nakuruRows] = await Promise.all([
    fetchSheetRows("MAIN CAMPUS!A:Z"),
    fetchSheetRows("NAKURU CAMPUS!A:X"),
  ]);

  const students = [
    ...parseCampusRows(mainRows, "MAIN"),
    ...parseCampusRows(nakuruRows, "NAKURU"),
  ];

  const dashboard = buildDashboardData(students);
  const conflicts = buildConflictReport(students);

  return <Dashboard initialData={dashboard} initialConflicts={conflicts} />;
}
