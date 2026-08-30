const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** Parses values like "SEP - 2025" from the Intake/Year column. Tolerant of
 * extra/missing spacing and case ("Sep-2025", "sep - 2025", etc). Returns
 * null for anything that doesn't match — including blank values, which is
 * expected for Nakuru until it gets its own Intake/Year column. */
export function parseIntake(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  const m = raw.trim().toUpperCase().match(/^([A-Z]{3})\s*-\s*(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[1]];
  if (!month) return null;
  return { year: Number(m[2]), month };
}

/**
 * True only when the intake is parseable AND strictly after the term's
 * period — i.e. the student hadn't joined ICMHS yet during that term and
 * shouldn't be counted in its roster at all. An unparseable or blank intake
 * (no data to judge by) is never treated as "future" — we simply can't tell,
 * so the student stays in the roster and reconciles normally.
 */
export function isFutureIntake(raw: string, term: { year: number; endMonth: number }): boolean {
  const parsed = parseIntake(raw);
  if (!parsed) return false;
  return parsed.year * 12 + parsed.month > term.year * 12 + term.endMonth;
}
