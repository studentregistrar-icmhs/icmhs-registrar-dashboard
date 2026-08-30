export type Campus = "MAIN" | "NAKURU";

export type RawFlags = {
  graduation: boolean;
  reported: boolean;
  attachment: boolean;
  clinicals: boolean;
  deferred: boolean;
  dropped: boolean;
  completed: boolean;
  nyr: boolean;
};

export type Student = {
  admissionNo: string;
  name: string;
  courseCode: string;
  courseName: string;
  gender: string;
  campus: Campus;
  flagsJanApr: RawFlags;
  flagsMayAug: RawFlags;
};

const isBlank = (v: unknown) => {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s === "-" || s === "_";
};

// Column layout confirmed against the MAIN CAMPUS / NAKURU CAMPUS tabs used
// by the deferment app (admission no. = col B, name = C, programme name = E,
// campus code = J, "Deferred - Approved" = col W on MAIN CAMPUS).
const LAYOUT = {
  MAIN: {
    admissionNo: 1,
    name: 2,
    courseCode: 3,
    courseName: 4,
    gender: 7,
    janApr: 10, // 8 consecutive columns starting here
    mayAug: 18,
  },
  NAKURU: {
    admissionNo: 1,
    name: 2,
    courseCode: 3,
    courseName: 4,
    gender: 6,
    janApr: 8,
    mayAug: 16,
  },
} as const;

/** Exposed for lib/writeStatus.ts, which needs to compute exact write ranges. */
export const LAYOUT_FOR_WRITE = LAYOUT;

function readFlags(row: any[], start: number): RawFlags {
  return {
    graduation: !isBlank(row[start + 0]),
    reported: !isBlank(row[start + 1]),
    attachment: !isBlank(row[start + 2]),
    clinicals: !isBlank(row[start + 3]),
    deferred: !isBlank(row[start + 4]),
    dropped: !isBlank(row[start + 5]),
    completed: !isBlank(row[start + 6]),
    nyr: !isBlank(row[start + 7]),
  };
}

/** Reads the flags for one term ("flagsJanApr"/"flagsMayAug") directly from a raw row, given campus. */
export function readFlagsAt(row: any[], campus: Campus, block: "flagsJanApr" | "flagsMayAug"): RawFlags {
  const layout = LAYOUT[campus];
  return readFlags(row, block === "flagsJanApr" ? layout.janApr : layout.mayAug);
}

/**
 * Converts a legacy wide-column Student into the source-agnostic
 * ReconcilableStudent shape, picking one term's block of 8 flag columns.
 * Use this for any term still stored as JAN-APR / MAY-AUG style columns.
 */
export function toReconcilable(
  students: Student[],
  block: "flagsJanApr" | "flagsMayAug"
) {
  return students.map((s) => ({
    admissionNo: s.admissionNo,
    name: s.name,
    courseCode: s.courseCode,
    courseName: s.courseName,
    gender: s.gender,
    campus: s.campus,
    flags: s[block],
  }));
}

export function parseCampusRows(rows: any[][], campus: Campus): Student[] {
  const layout = LAYOUT[campus];
  const students: Student[] = [];
  // data starts at row index 2 (first two rows are the two-tier header)
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || isBlank(row[layout.admissionNo])) continue;
    students.push({
      admissionNo: String(row[layout.admissionNo]),
      name: String(row[layout.name] ?? "").trim(),
      courseCode: String(row[layout.courseCode] ?? "").trim(),
      courseName: String(row[layout.courseName] ?? "").trim(),
      gender: String(row[layout.gender] ?? "").trim(),
      campus,
      flagsJanApr: readFlags(row, layout.janApr),
      flagsMayAug: readFlags(row, layout.mayAug),
    });
  }
  return students;
}
