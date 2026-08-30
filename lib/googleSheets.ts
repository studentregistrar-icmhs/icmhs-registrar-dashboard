import { google } from "googleapis";

/**
 * Client against the same Google Sheet the deferment app uses. Reuses
 * GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY from that project.
 *
 * Scope is now full read/write (not readonly) since the dashboard can
 * write status updates back to the sheet. The service account itself
 * must have Editor access on this specific sheet — it almost certainly
 * already does, since the deferment app writes to column W using the
 * same credentials.
 */
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY env vars."
    );
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function getSheetId(): string {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Missing GOOGLE_SHEET_ID env var.");
  return sheetId;
}

export async function fetchSheetRows(tabRange: string): Promise<any[][]> {
  const res = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: tabRange,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values ?? [];
}

/** Overwrites a single range (e.g. "MAIN CAMPUS!S15:Z15") with the given row values. */
export async function updateRange(range: string, values: any[]): Promise<void> {
  await getSheetsClient().spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

/** Appends one row to the end of a tab (used for the append-only Status Log). */
export async function appendRow(tabName: string, values: any[]): Promise<void> {
  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}
