"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";
import type { DashboardData } from "@/lib/aggregate";
import type { ConflictRow } from "@/lib/reconcile";

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
    return rows;
  }, [data, campus, query]);

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
              ? `Reading live from Google Sheets · last updated ${new Date(data.generatedAt).toLocaleString()}`
              : `Static snapshot from an uploaded workbook · generated ${new Date(data.generatedAt).toLocaleDateString()}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search programme or code…"
                style={styles.search}
              />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Code</th>
                    <th style={{ ...styles.th, textAlign: "left" }}>Programme</th>
                    <th style={styles.th}>Main</th>
                    <th style={styles.th}>Nakuru</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>Grad.</th>
                    <th style={styles.th}>In Sess.</th>
                    <th style={styles.th}>Compl.</th>
                    <th style={styles.th}>Dropped</th>
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
        <section style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.h2}>Data Quality — Conflicting Status Flags</h2>
            <span style={styles.cardNote}>
              students with more than one status column marked in the sheet
            </span>
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
    >
      <div style={styles.kpiLabel}>{label}</div>
      <div style={{ ...styles.kpiValue, fontSize: big ? 34 : 26 }}>{fmt(value)}</div>
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
        <div style={panelStyles.count}>{fmt(students.length)} student{students.length === 1 ? "" : "s"}</div>
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
