import { google } from "googleapis";

/**
 * Read-only client against the same Google Sheet the deferment app uses.
 * Reuses GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY from that project.
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
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function fetchSheetRows(tabRange: string): Promise<any[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Missing GOOGLE_SHEET_ID env var.");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tabRange,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values ?? [];
}
