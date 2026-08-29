import { RawFlags } from "./parse";
import { reconcile, STATUS_LABEL, ReconcilableStudent } from "./reconcile";

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

  const conflictCount = students.filter((s) => reconcile(s.flags).hasConflict).length;

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
    conflictCount,
  };
}
