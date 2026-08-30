import Link from "next/link";
import { TERMS } from "@/lib/terms";
import { loadTermData } from "@/lib/loadTermData";

export const revalidate = Number(process.env.REVALIDATE_SECONDS ?? 120);

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", sage: "#3F7D4F", rose: "#B0432E", slate: "#54625D", grey: "#98A39C",
};

const fmt = (n: number) => n.toLocaleString("en-US");

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function Home() {
  const results = await Promise.all(
    TERMS.map(async (t) => ({ term: t, data: await loadTermData(t.slug) }))
  );

  const ready = results.filter((r) => r.data && !r.data.error);
  const totalTracked = ready.reduce((sum, r) => sum + r.data!.dashboard.totals.all, 0);
  const liveCount = ready.filter((r) => r.data!.isLive).length;
  const openConflicts = ready.reduce((sum, r) => sum + r.data!.dashboard.conflictCount, 0);

  return (
    <div style={styles.page}>
      <style>{`
        .term-card { transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease; }
        .term-card:hover { box-shadow: 0 6px 16px rgba(18,42,40,0.12); transform: translateY(-2px); border-color: ${C.line}; }
        .search-box { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        .search-box:hover { box-shadow: 0 2px 8px rgba(18,42,40,0.08); border-color: ${C.teal}; }
      `}</style>

      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>ICMHS · REGISTRAR'S OFFICE</div>
          <h1 style={styles.h1}>Student Population Tracker</h1>
          <p style={styles.sub}>Thika Main &amp; Nakuru campuses — pick a term below, or look up a student directly.</p>
        </div>
        <Link href="/students" className="search-box" style={styles.searchBox}>
          <span style={styles.searchIcon}>⌕</span>
          <span style={styles.searchText}>Find a student by name or admission no.</span>
        </Link>
      </header>

      {ready.length > 0 && (
        <div style={styles.statStrip}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{fmt(totalTracked)}</div>
            <div style={styles.statLabel}>Students tracked</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <div style={styles.statValue}>{liveCount} / {TERMS.length}</div>
            <div style={styles.statLabel}>Terms live</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <div style={{ ...styles.statValue, color: openConflicts > 0 ? C.rose : C.ink }}>{fmt(openConflicts)}</div>
            <div style={styles.statLabel}>Open conflicts</div>
          </div>
        </div>
      )}

      <div style={styles.grid}>
        {results.map(({ term: t, data }) => {
          const isReady = !!data && !data.error;
          const accent = !isReady ? C.grey : data!.isLive ? C.teal : C.sage;
          return (
            <Link key={t.slug} href={`/terms/${t.slug}`} className="term-card" style={{ ...styles.card, borderTopColor: accent }}>
              <div style={styles.cardTop}>
                <div style={styles.cardLabel}>{t.label}</div>
                {t.isDefault && <span style={styles.currentBadge}>CURRENT</span>}
              </div>
              {isReady ? (
                <>
                  <div style={styles.cardHeadcount}>
                    {fmt(data!.dashboard.totals.all)}
                    <span style={styles.cardHeadcountUnit}> students</span>
                  </div>
                  <div style={styles.cardMetaRow}>
                    <span style={{ color: data!.isLive ? C.teal : C.slate }}>{data!.isLive ? "● Live" : "○ Static snapshot"}</span>
                    <span>{timeAgo(data!.dashboard.generatedAt)}</span>
                  </div>
                  {data!.dashboard.conflictCount > 0 && (
                    <div style={styles.cardConflict}>{data!.dashboard.conflictCount} flagged for review</div>
                  )}
                </>
              ) : (
                <div style={styles.cardNotReady}>Not set up yet — see README</div>
              )}
            </Link>
          );
        })}
      </div>

      <footer style={styles.footer}>Imperial College of Medical and Health Sciences · Thika &amp; Nakuru</footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, padding: "48px 32px 40px", minHeight: "100vh", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20, maxWidth: 980, marginBottom: 28 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.12em", color: C.teal, fontWeight: 600, marginBottom: 6 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 34, margin: 0, letterSpacing: "-0.01em" },
  sub: { fontSize: 14, color: C.slate, marginTop: 8, maxWidth: 480, lineHeight: 1.5 },
  searchBox: { display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 16px", textDecoration: "none", color: C.slate, fontSize: 13.5, minWidth: 260, boxShadow: "0 1px 2px rgba(18,42,40,0.05)" },
  searchIcon: { fontSize: 16, color: C.teal, fontWeight: 700 },
  searchText: { fontWeight: 500 },
  statStrip: { display: "flex", alignItems: "center", gap: 28, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 24px", maxWidth: 980, marginBottom: 32, boxShadow: "0 1px 2px rgba(18,42,40,0.05)" },
  statItem: { display: "flex", flexDirection: "column", gap: 3 },
  statValue: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, fontSize: 22, color: C.ink },
  statLabel: { fontSize: 11, color: C.slate, textTransform: "uppercase", letterSpacing: "0.05em" },
  statDivider: { width: 1, alignSelf: "stretch", background: C.line },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, maxWidth: 980 },
  card: { display: "block", background: C.card, border: `1px solid ${C.line}`, borderTop: "3px solid", borderRadius: 10, padding: "18px 18px 16px", textDecoration: "none", color: C.ink, boxShadow: "0 1px 3px rgba(18,42,40,0.07)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardLabel: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 17 },
  currentBadge: { fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", color: C.teal, border: `1px solid ${C.teal}`, borderRadius: 4, padding: "2px 6px" },
  cardHeadcount: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, fontSize: 24, color: C.ink, marginBottom: 8 },
  cardHeadcountUnit: { fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 12.5, color: C.slate },
  cardMetaRow: { display: "flex", justifyContent: "space-between", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: C.slate, textTransform: "uppercase", letterSpacing: "0.03em" },
  cardConflict: { marginTop: 10, fontSize: 11.5, color: C.rose, fontWeight: 600 },
  cardNotReady: { fontSize: 12.5, color: C.grey, fontStyle: "italic" },
  footer: { marginTop: 44, fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: C.grey, letterSpacing: "0.02em" },
};
