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
      <div style={styles.eyebrow}>ICMHS · REGISTRAR'S OFFICE</div>
      <h1 style={styles.h1}>Student Population Tracker</h1>
      <p style={styles.sub}>Choose a term to view its dashboard.</p>
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
  page: { fontFamily: "Inter, sans-serif", background: "#EEF1EA", color: "#122A28", padding: "48px 32px", minHeight: "100vh", boxSizing: "border-box" },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.12em", color: "#0F7268", fontWeight: 600, marginBottom: 6 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 32, margin: 0 },
  sub: { fontSize: 14, color: "#54625D", marginTop: 8, marginBottom: 28 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, maxWidth: 900 },
  card: { display: "block", background: "#fff", border: "1px solid #D9DFD3", borderRadius: 10, padding: "20px 18px", textDecoration: "none", color: "#122A28", boxShadow: "0 1px 3px rgba(18,42,40,0.07)" },
  cardLabel: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 17, marginBottom: 6 },
  cardMeta: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, color: "#54625D", textTransform: "uppercase", letterSpacing: "0.04em" },
};
