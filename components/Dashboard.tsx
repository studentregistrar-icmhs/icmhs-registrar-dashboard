"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";
import type { DashboardData } from "@/lib/aggregate";
import type { ConflictRow } from "@/lib/reconcile";
import { toCsv, downloadCsv } from "@/lib/csv";

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", navy: "#2C3E66", amber: "#C2760F", sage: "#3F7D4F",
  rose: "#B0432E", violet: "#6B4FA3", slate: "#54625D", grey: "#98A39C",
};

const STATUS_ORDER = [
  { label: "Graduated", color: C.sage },
  { label: "In Session", color: C.teal },
  { label: "Completed", color: C.navy },
  { label: "Attachment", color: C.violet },
  { label: "Dropped", color: C.rose },
  { label: "Deferred", color: C.amber },
  { label: "Clinicals", color: "#8B6BAF" },
  { label: "Not Yet Reported", color: C.grey },
  { label: "Unmarked", color: "#C9CFC5" },
];

const fmt = (n: number) => n.toLocaleString("en-US");

function relativeTime(iso: string, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

type Props = {
  initialData: DashboardData;
  initialConflicts: ConflictRow[];
  termLabel: string;
  isLive: boolean;
  apiTermSlug: string;
};

export default function Dashboard({ initialData, initialConflicts, termLabel, isLive, apiTermSlug }: Props) {
  const [data, setData] = useState(initialData);
  const [conflicts, setConflicts] = useState(initialConflicts);
  const [campus, setCampus] = useState<"all" | "main" | "nakuru">("all");
  const [tab, setTab] = useState<"overview" | "quality">("overview");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [sortKey, setSortKey] = useState<"code" | "name" | "totalMain" | "totalNakuru" | "total" | "Graduated" | "In Session" | "Completed" | "Dropped">("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const allStudentsFlat = useMemo(() => {
    const out: { admissionNo: string; name: string; courseCode: string; courseName: string; campus: string; status: string }[] = [];
    for (const [status, list] of Object.entries(data.studentsByStatus)) {
      for (const s of list) out.push({ ...s, status });
    }
    return out;
  }, [data]);

  const globalResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return [];
    let rows = allStudentsFlat.filter(
      (s) => s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q)
    );
    if (campus !== "all") {
      const c = campus === "main" ? "MAIN" : "NAKURU";
      rows = rows.filter((s) => s.campus === c);
    }
    return rows.slice(0, 200);
  }, [globalQuery, allStudentsFlat, campus]);

  const kpis = data.statusCounts[campus];
  const total = data.totals[campus === "all" ? "all" : campus];
  const genderData = useMemo(
    () => Object.entries(data.genders[campus]).map(([name, value]) => ({ name, value })),
    [data, campus]
  );
  const topPrograms = useMemo(() => {
    const key = campus === "main" ? "totalMain" : campus === "nakuru" ? "totalNakuru" : "total";
    return [...data.programs]
      .filter((p) => (p as any)[key] > 0)
      .sort((a, b) => (b as any)[key] - (a as any)[key])
      .slice(0, 12)
      .map((p) => ({ code: p.code, name: p.name, value: (p as any)[key] }));
  }, [data, campus]);
  const programsFiltered = useMemo(() => {
    let rows = data.programs.filter((p) => {
      if (campus === "main" && p.totalMain === 0) return false;
      if (campus === "nakuru" && p.totalNakuru === 0) return false;
      return true;
    });
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sortKey === "code" || sortKey === "name") {
        av = a[sortKey]; bv = b[sortKey];
        return dir * String(av).localeCompare(String(bv));
      }
      if (sortKey === "totalMain" || sortKey === "totalNakuru" || sortKey === "total") {
        av = a[sortKey]; bv = b[sortKey];
      } else {
        av = a.statusCounts[sortKey] ?? 0; bv = b.statusCounts[sortKey] ?? 0;
      }
      return dir * ((av as number) - (bv as number));
    });
    return rows;
  }, [data, campus, query, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function exportProgrammes() {
    const headers = ["Code", "Programme", "Main", "Nakuru", "Total", "Graduated", "In Session", "Completed", "Dropped"];
    const rows = programsFiltered.map((p) => [
      p.code, p.name, p.totalMain, p.totalNakuru, p.total,
      p.statusCounts["Graduated"] ?? 0, p.statusCounts["In Session"] ?? 0,
      p.statusCounts["Completed"] ?? 0, p.statusCounts["Dropped"] ?? 0,
    ]);
    downloadCsv(`${termLabel.replace(/\s+/g, "-")}-programmes.csv`, toCsv(headers, rows));
  }

  function exportConflicts() {
    const headers = ["Admission No.", "Name", "Campus", "Course", "Flags Set", "Resolved To"];
    const rows = conflicts.map((c) => [c.admissionNo, c.name, c.campus, c.courseCode, c.setStatuses.join("; "), c.resolvedTo]);
    downloadCsv(`${termLabel.replace(/\s+/g, "-")}-conflicts.csv`, toCsv(headers, rows));
  }

  function exportUnmarked() {
    const headers = ["Admission No.", "Name", "Campus", "Course"];
    const rows = unmarked.map((s) => [s.admissionNo, s.name, s.campus, s.courseName || s.courseCode]);
    downloadCsv(`${termLabel.replace(/\s+/g, "-")}-unmarked.csv`, toCsv(headers, rows));
  }

  const unmarked = useMemo(() => {
    let rows = data.studentsByStatus["Unmarked"] ?? [];
    if (campus !== "all") {
      const c = campus === "main" ? "MAIN" : "NAKURU";
      rows = rows.filter((s) => s.campus === c);
    }
    return rows;
  }, [data, campus]);

  const cleanCount = total - conflicts.length - unmarked.length;
  const qualityPct = total ? ((cleanCount / total) * 100).toFixed(1) : "0.0";

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/terms/${apiTermSlug}`, { method: "POST" });
      const json = await res.json();
      if (json.dashboard) {
        setData(json.dashboard);
        setConflicts(json.conflicts);
      }
    } finally {
      setRefreshing(false);
    }
  }

  const maxLedger = Math.max(...STATUS_ORDER.map((s) => kpis[s.label] || 0), 1);

  const studentPanelList = useMemo(() => {
    if (!selectedStatus) return [];
    let rows = data.studentsByStatus[selectedStatus] ?? [];
    if (campus !== "all") {
      const c = campus === "main" ? "MAIN" : "NAKURU";
      rows = rows.filter((s) => s.campus === c);
    }
    if (studentQuery.trim()) {
      const q = studentQuery.trim().toLowerCase();
      rows = rows.filter(
        (s) => s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [selectedStatus, data, campus, studentQuery]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <Link href="/" style={styles.backLink}>← All terms</Link>
          <div style={styles.eyebrow}>ICMHS · REGISTRAR'S OFFICE · {isLive ? "LIVE" : "STATIC SNAPSHOT"}</div>
          <h1 style={styles.h1}>{termLabel}</h1>
          <div style={styles.sub}>
            {isLive
              ? `Reading live from Google Sheets · updated ${relativeTime(data.generatedAt, now)}`
              : `Static snapshot from an uploaded workbook · generated ${new Date(data.generatedAt).toLocaleDateString()}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <input
              value={globalQuery}
              onChange={(e) => { setGlobalQuery(e.target.value); setGlobalSearchOpen(true); }}
              onFocus={() => setGlobalSearchOpen(true)}
              placeholder="Find a student…"
              style={styles.globalSearch}
            />
            {globalSearchOpen && globalQuery.trim() && (
              <GlobalSearchDropdown
                results={globalResults}
                onClose={() => setGlobalSearchOpen(false)}
              />
            )}
          </div>
          <div style={styles.toggleGroup}>
            {(["all", "main", "nakuru"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCampus(c)}
                style={{ ...styles.toggleBtn, ...(campus === c ? styles.toggleBtnActive : {}) }}
              >
                {c === "all" ? "All Campuses" : c === "main" ? "Thika (Main)" : "Nakuru"}
              </button>
            ))}
          </div>
          {isLive && (
            <button onClick={handleRefresh} disabled={refreshing} style={styles.refreshBtn}>
              {refreshing ? "Refreshing…" : "Refresh now"}
            </button>
          )}
        </div>
      </header>

      <div style={styles.tabRow}>
        <button
          onClick={() => setTab("overview")}
          style={{ ...styles.tabBtn, ...(tab === "overview" ? styles.tabBtnActive : {}) }}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("quality")}
          style={{ ...styles.tabBtn, ...(tab === "quality" ? styles.tabBtnActive : {}) }}
        >
          Data Quality {conflicts.length > 0 && <span style={styles.badge}>{conflicts.length}</span>}
        </button>
      </div>

      {tab === "overview" ? (
        <>
          <section style={styles.kpiStrip}>
            <KpiCard label="Total Roll" value={total} accent={C.ink} big />
            {STATUS_ORDER.filter((s) => s.label !== "Unmarked").map((s) => (
              <KpiCard
                key={s.label}
                label={s.label}
                value={kpis[s.label] ?? 0}
                accent={s.color}
                onClick={() => setSelectedStatus(s.label)}
              />
            ))}
          </section>

          <section style={styles.card}>
            <div style={styles.cardHead}>
              <h2 style={styles.h2}>Status Ledger</h2>
              <span style={styles.cardNote}>
                canonical status per student (conflicts auto-resolved) · May–Aug 2026
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {STATUS_ORDER.map((s) => {
                const val = kpis[s.label] ?? 0;
                const pct = total ? ((val / total) * 100).toFixed(1) : "0.0";
                const width = (val / maxLedger) * 100;
                return (
                  <div
                    key={s.label}
                    style={{ ...styles.ledgerRow, cursor: "pointer" }}
                    onClick={() => setSelectedStatus(s.label)}
                    title={`View ${s.label} students`}
                  >
                    <div style={styles.ledgerLabel}>{s.label}</div>
                    <div style={styles.ledgerBarTrack}>
                      <div style={{ ...styles.ledgerBarFill, width: `${width}%`, background: s.color }} />
                    </div>
                    <div style={styles.ledgerFigures}>
                      <span style={styles.ledgerVal}>{fmt(val)}</span>
                      <span style={styles.ledgerPct}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={styles.ledgerFoot}>
              Each student's status is resolved to a single canonical value using a precedence
              order (see lib/reconcile.ts). {conflicts.length} student(s) had more than one flag
              set this pull — see the Data Quality tab.
            </div>
          </section>

          <section style={{ ...styles.card, maxWidth: 460 }}>
            <div style={styles.cardHead}><h2 style={styles.h2}>Gender Split</h2></div>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={2}>
                    {genderData.map((e) => (
                      <Cell key={e.name} fill={e.name === "Female" ? C.teal : C.amber} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [fmt(v), n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHead}><h2 style={styles.h2}>Largest Programmes</h2></div>
            <div style={{ width: "100%", height: Math.max(320, topPrograms.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={topPrograms} layout="vertical" margin={{ top: 4, right: 30, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={C.line} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: C.slate }} />
                  <YAxis type="category" dataKey="code" width={70} tick={{ fontSize: 11, fill: C.ink }} />
                  <Tooltip formatter={(v: any, n: any, p: any) => [fmt(v), p.payload.name]} />
                  <Bar dataKey="value" fill={C.navy} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHead}>
              <h2 style={styles.h2}>All Programmes</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search programme or code…"
                  style={styles.search}
                />
                <button onClick={exportProgrammes} style={styles.exportBtn}>Export CSV</button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <SortableTh label="Code" active={sortKey === "code"} dir={sortDir} onClick={() => toggleSort("code")} />
                    <SortableTh label="Programme" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} align="left" />
                    <SortableTh label="Main" active={sortKey === "totalMain"} dir={sortDir} onClick={() => toggleSort("totalMain")} />
                    <SortableTh label="Nakuru" active={sortKey === "totalNakuru"} dir={sortDir} onClick={() => toggleSort("totalNakuru")} />
                    <SortableTh label="Total" active={sortKey === "total"} dir={sortDir} onClick={() => toggleSort("total")} />
                    <SortableTh label="Grad." active={sortKey === "Graduated"} dir={sortDir} onClick={() => toggleSort("Graduated")} />
                    <SortableTh label="In Sess." active={sortKey === "In Session"} dir={sortDir} onClick={() => toggleSort("In Session")} />
                    <SortableTh label="Compl." active={sortKey === "Completed"} dir={sortDir} onClick={() => toggleSort("Completed")} />
                    <SortableTh label="Dropped" active={sortKey === "Dropped"} dir={sortDir} onClick={() => toggleSort("Dropped")} />
                  </tr>
                </thead>
                <tbody>
                  {programsFiltered.map((p, i) => (
                    <tr key={p.code} style={i % 2 ? styles.trOdd : undefined}>
                      <td style={styles.tdCode}>{p.code}</td>
                      <td style={styles.tdName}>{p.name}</td>
                      <td style={styles.tdNum}>{fmt(p.totalMain)}</td>
                      <td style={styles.tdNum}>{fmt(p.totalNakuru)}</td>
                      <td style={{ ...styles.tdNum, fontWeight: 600, color: C.ink }}>{fmt(p.total)}</td>
                      <td style={styles.tdNum}>{fmt(p.statusCounts["Graduated"] ?? 0)}</td>
                      <td style={styles.tdNum}>{fmt(p.statusCounts["In Session"] ?? 0)}</td>
                      <td style={styles.tdNum}>{fmt(p.statusCounts["Completed"] ?? 0)}</td>
                      <td style={{ ...styles.tdNum, color: (p.statusCounts["Dropped"] ?? 0) > 0 ? C.rose : C.slate }}>
                        {fmt(p.statusCounts["Dropped"] ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
        <section style={{ ...styles.card, display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={styles.kpiLabel}>Clean Records</div>
            <div style={{ ...styles.kpiValue, fontSize: 30, color: C.sage }}>{qualityPct}%</div>
          </div>
          <div style={{ fontSize: 13, color: C.slate, lineHeight: 1.6, maxWidth: 480 }}>
            <strong style={{ color: C.ink }}>{fmt(cleanCount)}</strong> of <strong style={{ color: C.ink }}>{fmt(total)}</strong> students
            {campus !== "all" ? ` at this campus` : ""} have exactly one status flag set.{" "}
            <strong style={{ color: C.rose }}>{fmt(conflicts.length)}</strong> have conflicting flags and{" "}
            <strong style={{ color: C.grey }}>{fmt(unmarked.length)}</strong> have none set at all — both need a look at the source sheet.
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.h2}>Conflicting Status Flags</h2>
              <span style={styles.cardNote}>students with more than one status column marked in the sheet</span>
            </div>
            {conflicts.length > 0 && <button onClick={exportConflicts} style={styles.exportBtn}>Export CSV</button>}
          </div>
          {conflicts.length === 0 ? (
            <div style={{ padding: "20px 0", color: C.slate }}>
              No conflicts found — every student has exactly one status flag set. 🎉
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Admission No.</th>
                    <th style={{ ...styles.th, textAlign: "left" }}>Name</th>
                    <th style={styles.th}>Campus</th>
                    <th style={styles.th}>Course</th>
                    <th style={{ ...styles.th, textAlign: "left" }}>Flags Set</th>
                    <th style={{ ...styles.th, textAlign: "left" }}>Resolved To</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((c, i) => (
                    <tr key={c.admissionNo + i} style={i % 2 ? styles.trOdd : undefined}>
                      <td style={styles.tdCode}>{c.admissionNo}</td>
                      <td style={styles.tdName}>{c.name}</td>
                      <td style={styles.tdNum}>{c.campus}</td>
                      <td style={styles.tdNum}>{c.courseCode}</td>
                      <td style={{ ...styles.tdName, color: C.rose }}>{c.setStatuses.join(", ")}</td>
                      <td style={{ ...styles.tdName, fontWeight: 600 }}>{c.resolvedTo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={styles.ledgerFoot}>
            Fix these at the source (the Google Sheet) by clearing the extra flag columns —
            the dashboard will pick up the correction on its next refresh.
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.h2}>Unmarked Students</h2>
              <span style={styles.cardNote}>students with no status column marked at all this term</span>
            </div>
            {unmarked.length > 0 && <button onClick={exportUnmarked} style={styles.exportBtn}>Export CSV</button>}
          </div>
          {unmarked.length === 0 ? (
            <div style={{ padding: "20px 0", color: C.slate }}>
              No unmarked students — everyone has at least one status flag set. 🎉
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Admission No.</th>
                    <th style={{ ...styles.th, textAlign: "left" }}>Name</th>
                    <th style={styles.th}>Campus</th>
                    <th style={{ ...styles.th, textAlign: "left" }}>Course</th>
                  </tr>
                </thead>
                <tbody>
                  {unmarked.map((s, i) => (
                    <tr key={s.admissionNo + i} style={i % 2 ? styles.trOdd : undefined}>
                      <td style={styles.tdCode}>{s.admissionNo}</td>
                      <td style={styles.tdName}>{s.name}</td>
                      <td style={styles.tdNum}>{s.campus}</td>
                      <td style={styles.tdName}>{s.courseName || s.courseCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={styles.ledgerFoot}>
            Likely cause: the student's row exists but none of the 8 status columns were filled in
            for this term yet. Mark the correct status at the source and it'll clear on next refresh.
          </div>
        </section>
        </>
      )}

      <footer style={styles.footer}>
        {isLive
          ? "Live from the MAIN CAMPUS / NAKURU CAMPUS Google Sheet used by icmhsdeferment."
          : "Static snapshot — this term's source workbook is no longer being updated."}
      </footer>

      {selectedStatus && (
        <StudentListPanel
          status={selectedStatus}
          students={studentPanelList}
          query={studentQuery}
          onQueryChange={setStudentQuery}
          onClose={() => {
            setSelectedStatus(null);
            setStudentQuery("");
          }}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, accent, big, onClick }: { label: string; value: number; accent: string; big?: boolean; onClick?: () => void }) {
  return (
    <div
      style={{ ...styles.kpiCard, borderTopColor: accent, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      title={onClick ? `View ${label} students` : undefined}
    >
      <div style={styles.kpiLabel}>{label}</div>
      <div style={{ ...styles.kpiValue, fontSize: big ? 34 : 26 }}>{fmt(value)}</div>
      {onClick && <div style={styles.kpiHint}>View list →</div>}
    </div>
  );
}

function SortableTh({
  label, active, dir, onClick, align,
}: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; align?: "left" }) {
  return (
    <th
      style={{ ...styles.th, textAlign: align ?? "right", cursor: "pointer", userSelect: "none", color: active ? C.teal : undefined }}
      onClick={onClick}
    >
      {label}{active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

function GlobalSearchDropdown({
  results,
  onClose,
}: {
  results: { admissionNo: string; name: string; courseCode: string; courseName: string; campus: string; status: string }[];
  onClose: () => void;
}) {
  return (
    <div style={styles.globalDropdown}>
      {results.length === 0 ? (
        <div style={{ padding: "12px 14px", fontSize: 13, color: C.slate }}>No matching students.</div>
      ) : (
        <>
          <div style={{ padding: "8px 14px", fontSize: 11, color: C.slate, fontFamily: "IBM Plex Mono, monospace", display: "flex", justifyContent: "space-between" }}>
            <span>{results.length}{results.length === 200 ? "+" : ""} match{results.length === 1 ? "" : "es"}</span>
            <span onClick={onClose} style={{ cursor: "pointer" }}>✕</span>
          </div>
          {results.slice(0, 30).map((s, i) => (
            <div key={s.admissionNo + i} style={styles.globalRow}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: C.slate, fontFamily: "IBM Plex Mono, monospace" }}>
                  {s.admissionNo} · {s.courseCode} · {s.campus}
                </div>
              </div>
              <span style={styles.globalStatusPill}>{s.status}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StudentListPanel({
  status,
  students,
  query,
  onQueryChange,
  onClose,
}: {
  status: string;
  students: { admissionNo: string; name: string; courseCode: string; courseName: string; campus: string }[];
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={panelStyles.overlay} onClick={onClose}>
      <div style={panelStyles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={panelStyles.header}>
          <div>
            <div style={panelStyles.eyebrow}>STATUS</div>
            <h2 style={panelStyles.title}>{status}</h2>
          </div>
          <button style={panelStyles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name or admission no…"
          style={panelStyles.search}
          autoFocus
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={panelStyles.count}>{fmt(students.length)} student{students.length === 1 ? "" : "s"}</div>
          {students.length > 0 && (
            <button
              style={panelStyles.exportBtn}
              onClick={() =>
                downloadCsv(
                  `${status.replace(/\s+/g, "-")}-students.csv`,
                  toCsv(
                    ["Admission No.", "Name", "Programme", "Campus"],
                    students.map((s) => [s.admissionNo, s.name, s.courseName || s.courseCode, s.campus])
                  )
                )
              }
            >
              Export CSV
            </button>
          )}
        </div>
        <div style={panelStyles.listWrap}>
          <table style={panelStyles.table}>
            <thead>
              <tr>
                <th style={panelStyles.th}>Admission No.</th>
                <th style={{ ...panelStyles.th, textAlign: "left" }}>Name</th>
                <th style={{ ...panelStyles.th, textAlign: "left" }}>Programme</th>
                <th style={panelStyles.th}>Campus</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.admissionNo + i} style={i % 2 ? panelStyles.trOdd : undefined}>
                  <td style={panelStyles.tdCode}>{s.admissionNo}</td>
                  <td style={panelStyles.tdName}>{s.name}</td>
                  <td style={panelStyles.tdName}>{s.courseName || s.courseCode}</td>
                  <td style={panelStyles.tdNum}>{s.campus}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: C.slate }}>
                    No matching students.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const panelStyles: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(18,42,40,0.45)", display: "flex", justifyContent: "flex-end", zIndex: 50 },
  panel: { background: "#fff", width: "min(560px, 100%)", height: "100%", padding: "24px 24px 16px", boxSizing: "border-box", display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.15)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.12em", color: C.teal, fontWeight: 600 },
  title: { fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, margin: "4px 0 0" },
  closeBtn: { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: C.slate, padding: 4 },
  exportBtn: { border: `1px solid ${C.line}`, background: "#fff", color: C.ink, padding: "5px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  search: { border: `1px solid ${C.line}`, borderRadius: 6, padding: "9px 12px", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none", marginBottom: 10 },
  count: { fontSize: 12, color: C.slate, fontFamily: "IBM Plex Mono, monospace", marginBottom: 10 },
  listWrap: { overflowY: "auto", flex: 1 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px", borderBottom: `2px solid ${C.ink}`, position: "sticky", top: 0, background: "#fff" },
  trOdd: { background: "#F5F7F2" },
  tdCode: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, padding: "6px 8px", color: C.teal, fontWeight: 600, whiteSpace: "nowrap" },
  tdName: { padding: "6px 8px", color: C.ink },
  tdNum: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, padding: "6px 8px", textAlign: "right", color: C.slate },
};

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, padding: "28px 32px 40px", minHeight: "100vh", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 14, borderBottom: `2px solid ${C.ink}`, paddingBottom: 16 },
  backLink: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: C.slate, textDecoration: "none", display: "inline-block", marginBottom: 8 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.12em", color: C.teal, fontWeight: 600, marginBottom: 4 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 30, margin: 0, lineHeight: 1.1 },
  sub: { fontSize: 12.5, color: C.slate, marginTop: 4, fontFamily: "IBM Plex Mono, monospace" },
  toggleGroup: { display: "flex", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 3, gap: 2 },
  toggleBtn: { border: "none", background: "transparent", padding: "8px 14px", fontSize: 13, fontWeight: 500, color: C.slate, borderRadius: 6, cursor: "pointer" },
  toggleBtnActive: { background: C.ink, color: "#fff" },
  refreshBtn: { border: `1px solid ${C.ink}`, background: C.ink, color: "#fff", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  tabRow: { display: "flex", gap: 6, marginBottom: 18 },
  tabBtn: { border: "none", background: "transparent", padding: "8px 4px", fontSize: 14, fontWeight: 600, color: C.slate, cursor: "pointer", borderBottom: "3px solid transparent" },
  tabBtnActive: { color: C.ink, borderBottom: `3px solid ${C.teal}` },
  badge: { background: C.rose, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, marginLeft: 6 },
  kpiStrip: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 },
  kpiCard: { background: C.card, borderTop: "3px solid", borderRadius: 8, padding: "12px 14px", boxShadow: "0 1px 2px rgba(18,42,40,0.06)" },
  kpiLabel: { fontSize: 11, color: C.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 },
  kpiValue: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, color: C.ink },
  kpiHint: { fontSize: 10.5, color: C.teal, marginTop: 6, fontFamily: "IBM Plex Mono, monospace" },
  exportBtn: { border: `1px solid ${C.line}`, background: "#fff", color: C.ink, padding: "7px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  globalSearch: { border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, width: 230, outline: "none", background: "#fff" },
  globalDropdown: { position: "absolute", top: "calc(100% + 6px)", left: 0, width: 340, maxHeight: 380, overflowY: "auto", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(18,42,40,0.15)", zIndex: 60 },
  globalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 14px", borderTop: `1px solid ${C.line}` },
  globalStatusPill: { fontSize: 10.5, fontFamily: "IBM Plex Mono, monospace", color: C.teal, background: "#E5F1EF", borderRadius: 12, padding: "3px 9px", whiteSpace: "nowrap" },
  card: { background: C.card, borderRadius: 10, padding: "20px 22px", marginBottom: 18, boxShadow: "0 1px 3px rgba(18,42,40,0.07)", border: `1px solid ${C.line}` },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  h2: { fontFamily: "Space Grotesk, sans-serif", fontSize: 18, fontWeight: 600, margin: 0 },
  cardNote: { fontSize: 12, color: C.slate, fontFamily: "IBM Plex Mono, monospace" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 18, marginBottom: 18 },
  ledgerRow: { display: "grid", gridTemplateColumns: "150px 1fr 110px", alignItems: "center", gap: 12 },
  ledgerLabel: { fontSize: 13, fontWeight: 500, color: C.ink },
  ledgerBarTrack: { background: C.bg, borderRadius: 4, height: 16, overflow: "hidden", border: `1px solid ${C.line}` },
  ledgerBarFill: { height: "100%", borderRadius: 4 },
  ledgerFigures: { display: "flex", justifyContent: "flex-end", gap: 8, fontFamily: "IBM Plex Mono, monospace" },
  ledgerVal: { fontSize: 13, fontWeight: 600, color: C.ink, minWidth: 46, textAlign: "right" },
  ledgerPct: { fontSize: 12, color: C.slate, minWidth: 46, textAlign: "right" },
  ledgerFoot: { marginTop: 14, fontSize: 11.5, color: C.slate, borderTop: `1px dashed ${C.line}`, paddingTop: 10, lineHeight: 1.5 },
  search: { border: `1px solid ${C.line}`, borderRadius: 6, padding: "7px 12px", fontSize: 13, width: 220, outline: "none" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 10px", borderBottom: `2px solid ${C.ink}`, whiteSpace: "nowrap" },
  trOdd: { background: "#F5F7F2" },
  tdCode: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, padding: "7px 10px", color: C.teal, fontWeight: 600, whiteSpace: "nowrap" },
  tdName: { padding: "7px 10px", color: C.ink, minWidth: 200 },
  tdNum: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5, padding: "7px 10px", textAlign: "right", color: C.slate, whiteSpace: "nowrap" },
  footer: { fontSize: 11.5, color: C.slate, textAlign: "center", marginTop: 8, fontFamily: "IBM Plex Mono, monospace" },
};
