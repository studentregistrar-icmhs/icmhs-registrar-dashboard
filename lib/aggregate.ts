import { RawFlags } from "./parse";
import { reconcile, STATUS_LABEL, ReconcilableStudent } from "./reconcile";
import { getDepartment } from "./departments";

export type StudentSummary = {
  admissionNo: string;
  name: string;
  courseCode: string;
  courseName: string;
  campus: "MAIN" | "NAKURU";
  gender: string;
  contacts: string;
  intakeYear: string;
};

export type DashboardData = {
  generatedAt: string;
  totals: { main: number; nakuru: number; all: number };
  statusCounts: {
    all: Record<string, number>;
    main: Record<string, number>;
    nakuru: Record<string, number>;
  };
  genders: {
    all: Record<string, number>;
    main: Record<string, number>;
    nakuru: Record<string, number>;
  };
  programs: {
    code: string;
    name: string;
    totalMain: number;
    totalNakuru: number;
    total: number;
    statusCounts: Record<string, number>;
  }[];
  departments: {
    name: string;
    totalMain: number;
    totalNakuru: number;
    total: number;
    statusCounts: Record<string, number>;
    courseCodes: string[];
  }[];
  /** Every student, grouped by their canonical status label. Powers the
   * "click a status to see who's in it" drill-down in the UI. */
  studentsByStatus: Record<string, StudentSummary[]>;
  conflictCount: number;
};

const STATUS_KEYS = Object.keys(STATUS_LABEL) as (keyof RawFlags)[];

function emptyStatusCounts(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const k of STATUS_KEYS) o[STATUS_LABEL[k]] = 0;
  o["Unmarked"] = 0;
  return o;
}

function tallyFlags(students: ReconcilableStudent[]) {
  const counts = emptyStatusCounts();
  for (const s of students) {
    const r = reconcile(s.flags);
    const label = r.canonicalStatus === "UNMARKED" ? "Unmarked" : STATUS_LABEL[r.canonicalStatus];
    counts[label] += 1;
  }
  return counts;
}

/** Builds one term's dashboard data from its normalized student list. */
export function buildDashboardData(students: ReconcilableStudent[]): DashboardData {
  const main = students.filter((s) => s.campus === "MAIN");
  const nakuru = students.filter((s) => s.campus === "NAKURU");

  const genderTally = (list: ReconcilableStudent[]) => {
    const g: Record<string, number> = {};
    for (const s of list) {
      const key = s.gender || "Unknown";
      if (!key.trim()) continue;
      g[key] = (g[key] ?? 0) + 1;
    }
    return g;
  };

  const programMap = new Map<
    string,
    { name: string; totalMain: number; totalNakuru: number; statusCounts: Record<string, number> }
  >();
  for (const s of students) {
    const key = s.courseCode || "UNKNOWN";
    if (!programMap.has(key)) {
      programMap.set(key, {
        name: s.courseName || key,
        totalMain: 0,
        totalNakuru: 0,
        statusCounts: emptyStatusCounts(),
      });
    }
    const p = programMap.get(key)!;
    if (s.campus === "MAIN") p.totalMain += 1;
    else p.totalNakuru += 1;
    const r = reconcile(s.flags);
    const label = r.canonicalStatus === "UNMARKED" ? "Unmarked" : STATUS_LABEL[r.canonicalStatus];
    p.statusCounts[label] += 1;
  }

  const programs = Array.from(programMap.entries())
    .map(([code, p]) => ({
      code,
      name: p.name,
      totalMain: p.totalMain,
      totalNakuru: p.totalNakuru,
      total: p.totalMain + p.totalNakuru,
      statusCounts: p.statusCounts,
    }))
    .sort((a, b) => b.total - a.total);

  const departmentMap = new Map<
    string,
    { totalMain: number; totalNakuru: number; statusCounts: Record<string, number>; courseCodes: Set<string> }
  >();
  for (const s of students) {
    const dept = getDepartment(s.courseCode);
    if (!departmentMap.has(dept)) {
      departmentMap.set(dept, { totalMain: 0, totalNakuru: 0, statusCounts: emptyStatusCounts(), courseCodes: new Set() });
    }
    const d = departmentMap.get(dept)!;
    if (s.campus === "MAIN") d.totalMain += 1;
    else d.totalNakuru += 1;
    if (s.courseCode) d.courseCodes.add(s.courseCode);
    const r = reconcile(s.flags);
    const label = r.canonicalStatus === "UNMARKED" ? "Unmarked" : STATUS_LABEL[r.canonicalStatus];
    d.statusCounts[label] += 1;
  }
  const departments = Array.from(departmentMap.entries())
    .map(([name, d]) => ({
      name,
      totalMain: d.totalMain,
      totalNakuru: d.totalNakuru,
      total: d.totalMain + d.totalNakuru,
      statusCounts: d.statusCounts,
      courseCodes: Array.from(d.courseCodes).sort(),
    }))
    .sort((a, b) => b.total - a.total);

  const conflictCount = students.filter((s) => reconcile(s.flags).hasConflict).length;

  const studentsByStatus: Record<string, StudentSummary[]> = {};
  for (const key of [...STATUS_KEYS.map((k) => STATUS_LABEL[k]), "Unmarked"]) {
    studentsByStatus[key] = [];
  }
  for (const s of students) {
    const r = reconcile(s.flags);
    const label = r.canonicalStatus === "UNMARKED" ? "Unmarked" : STATUS_LABEL[r.canonicalStatus];
    studentsByStatus[label].push({
      admissionNo: s.admissionNo,
      name: s.name,
      courseCode: s.courseCode,
      courseName: s.courseName,
      campus: s.campus,
      gender: s.gender,
      contacts: s.contacts,
      intakeYear: s.intakeYear,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: { main: main.length, nakuru: nakuru.length, all: students.length },
    statusCounts: {
      all: tallyFlags(students),
      main: tallyFlags(main),
      nakuru: tallyFlags(nakuru),
    },
    genders: {
      all: genderTally(students),
      main: genderTally(main),
      nakuru: genderTally(nakuru),
    },
    programs,
    departments,
    studentsByStatus,
    conflictCount,
  };
}
