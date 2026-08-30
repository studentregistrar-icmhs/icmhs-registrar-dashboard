import Link from "next/link";
import { TERMS } from "@/lib/terms";

export default function Home() {
  return (
    <div style={styles.page}>
      <div style={styles.eyebrow}>ICMHS · REGISTRAR'S OFFICE</div>
      <h1 style={styles.h1}>Student Population Tracker</h1>
      <p style={styles.sub}>Choose a term to view its dashboard.</p>
      <Link href="/students" style={styles.studentSearchLink}>🔍 Find a student</Link>
      <div style={styles.grid}>
        {TERMS.map((t) => (
          <Link key={t.slug} href={`/terms/${t.slug}`} style={styles.card}>
            <div style={styles.cardLabel}>{t.label}</div>
            <div style={styles.cardMeta}>
              {t.source.kind === "static" ? "Static snapshot" : "Live"}
              {t.isDefault ? " · current" : ""}
            </div>
          </Link>
        ))}
      </div>
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
  studentSearchLink: { display: "inline-block", marginBottom: 24, fontSize: 13.5, color: "#0F7268", textDecoration: "none", fontWeight: 600 },
};
