import { fetchSheetRows, updateRange, appendRow } from "./googleSheets";
import { findStudentRow } from "./rosterLookup";
import { getTerm, TERMS } from "./terms";
import { reconcile, STATUS_LABEL, LABEL_TO_FLAG, TERMINAL_STATUSES } from "./reconcile";
import { readFlagsAt, LAYOUT_FOR_WRITE } from "./parse";

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "terminal-lock"; blockingTerm: string; blockingStatus: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "unsupported-term" }
  | { ok: false; reason: "invalid-status" };

/**
 * Checks every live term for this student and returns the first one found
 * with a terminal status (Graduated/Dropped), if any. A student who has
 * ever graduated or dropped is locked everywhere unless overridden.
 */
async function findTerminalBlock(admissionNo: string): Promise<{ term: string; status: string } | null> {
  const loc = await findStudentRow(admissionNo);
  if (loc) {
    for (const term of TERMS) {
      if (term.source.kind !== "live-legacy") continue;
      const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
      const r = reconcile(flags);
      if (r.canonicalStatus !== "UNMARKED" && TERMINAL_STATUSES.includes(r.canonicalStatus)) {
        return { term: term.label, status: STATUS_LABEL[r.canonicalStatus] };
      }
    }
  }

  const logRows = await fetchSheetRows("STATUS LOG!A:D").catch(() => []);
  const latestPerTerm = new Map<string, string>();
  for (let i = 1; i < logRows.length; i++) {
    const [rowAdmission, term, status] = logRows[i] ?? [];
    if (String(rowAdmission) !== admissionNo) continue;
    latestPerTerm.set(String(term), String(status));
  }
  for (const [term, status] of latestPerTerm) {
    const key = LABEL_TO_FLAG[status.trim()];
    if (key && TERMINAL_STATUSES.includes(key)) {
      return { term, status };
    }
  }

  return null;
}

/** Sets a student's status for a term. Enforces the terminal lock unless override is true. */
export async function updateStudentStatus(opts: {
  admissionNo: string;
  termSlug: string;
  newStatusLabel: string;
  override?: boolean;
}): Promise<WriteResult> {
  const { admissionNo, termSlug, newStatusLabel, override } = opts;
  const term = getTerm(termSlug);
  if (!term) return { ok: false, reason: "unsupported-term" };
  const newKey = LABEL_TO_FLAG[newStatusLabel];
  if (!newKey) return { ok: false, reason: "invalid-status" };

  if (!override) {
    const blocked = await findTerminalBlock(admissionNo);
    if (blocked) {
      return { ok: false, reason: "terminal-lock", blockingTerm: blocked.term, blockingStatus: blocked.status };
    }
  }

  if (term.source.kind === "live-legacy") {
    const loc = await findStudentRow(admissionNo);
    if (!loc) return { ok: false, reason: "not-found" };
    const layout = LAYOUT_FOR_WRITE[loc.campus];
    const startCol = term.source.block === "flagsJanApr" ? layout.janApr : layout.mayAug;
    const values = (Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((k) =>
      k === newKey ? STATUS_LABEL[newKey] : "-"
    );
    const range = `${loc.campus === "MAIN" ? "MAIN CAMPUS" : "NAKURU CAMPUS"}!${colLetter(startCol)}${loc.sheetRowNumber}:${colLetter(startCol + 7)}${loc.sheetRowNumber}`;
    await updateRange(range, values);
    return { ok: true };
  }

  if (term.source.kind === "live-statuslog") {
    await appendRow("STATUS LOG", [admissionNo, term.source.termLabel, newStatusLabel, new Date().toISOString().slice(0, 10)]);
    return { ok: true };
  }

  return { ok: false, reason: "unsupported-term" }; // static historical terms are read-only
}

/** Clears every flag except the canonical one for a legacy term's conflict. Never touches Status Log terms (they can't conflict). */
export async function resolveLegacyConflict(admissionNo: string, termSlug: string): Promise<WriteResult> {
  const term = getTerm(termSlug);
  if (!term || term.source.kind !== "live-legacy") return { ok: false, reason: "unsupported-term" };

  const loc = await findStudentRow(admissionNo);
  if (!loc) return { ok: false, reason: "not-found" };

  const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
  const r = reconcile(flags);
  if (r.canonicalStatus === "UNMARKED") return { ok: false, reason: "invalid-status" };

  return updateStudentStatus({
    admissionNo,
    termSlug,
    newStatusLabel: STATUS_LABEL[r.canonicalStatus],
    override: true, // resolving a conflict never counts as "changing away from" a terminal status
  });
}

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
