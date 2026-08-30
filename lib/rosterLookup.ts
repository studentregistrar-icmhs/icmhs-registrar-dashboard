import { fetchSheetRows } from "./googleSheets";
import { Campus } from "./parse";

export type RowLocation = { campus: Campus; sheetRowNumber: number; rawRow: any[] };

const TABS: { campus: Campus; range: string; admissionCol: number }[] = [
  { campus: "MAIN", range: "MAIN CAMPUS!A:Z", admissionCol: 1 },
  { campus: "NAKURU", range: "NAKURU CAMPUS!A:X", admissionCol: 1 },
];

/**
 * Locates a student's row by admission number. Returns the 1-indexed
 * sheet row number (for A1-notation writes) and which campus tab they're on.
 */
export async function findStudentRow(admissionNo: string): Promise<RowLocation | null> {
  for (const tab of TABS) {
    const rows = await fetchSheetRows(tab.range);
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (row && String(row[tab.admissionCol]) === admissionNo) {
        return { campus: tab.campus, sheetRowNumber: i + 1, rawRow: row };
      }
    }
  }
  return null;
}
