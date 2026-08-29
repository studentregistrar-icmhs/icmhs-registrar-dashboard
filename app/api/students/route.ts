import { NextResponse } from "next/server";
import { fetchSheetRows } from "@/lib/googleSheets";
import { parseCampusRows } from "@/lib/parse";
import { buildDashboardData } from "@/lib/aggregate";
import { buildConflictReport } from "@/lib/reconcile";

// ISR-style caching for the App Router: revalidate on an interval, plus
// on-demand refresh via POST /api/refresh.
export const revalidate = Number(process.env.REVALIDATE_SECONDS ?? 120);

export async function GET() {
  try {
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

    return NextResponse.json({ dashboard, conflicts });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load sheet data" },
      { status: 500 }
    );
  }
}
