"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Result = { admissionNo: string; name: string; courseCode: string; courseName: string; campus: string };

export default function StudentSearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function search(value: string) {
    setQ(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(value)}`);
      const json = await res.json();
      setResults(json.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <Link href="/" style={styles.backLink}>← All terms</Link>
      <h1 style={styles.h1}>Find a student</h1>
      <input
        autoFocus
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder="Search by name or admission number…"
        style={styles.search}
      />
      {loading && <div style={styles.hint}>Searching…</div>}
      <div style={styles.list}>
        {results.map((r) => (
          <div
            key={r.admissionNo}
            style={styles.row}
            onClick={() => router.push(`/students/${encodeURIComponent(r.admissionNo)}`)}
          >
            <div>
              <div style={styles.name}>{r.name}</div>
              <div style={styles.meta}>{r.admissionNo} · {r.courseName || r.courseCode} · {r.campus}</div>
            </div>
            <div style={styles.arrow}>→</div>
          </div>
        ))}
        {!loading && q.trim().length >= 2 && results.length === 0 && (
          <div style={styles.hint}>No matches.</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: "#EEF1EA", color: "#122A28", padding: "40px 32px", minHeight: "100vh", boxSizing: "border-box", maxWidth: 640 },
  backLink: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#54625D", textDecoration: "none", display: "inline-block", marginBottom: 20 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 26, margin: "0 0 16px" },
  search: { border: "1px solid #D9DFD3", borderRadius: 8, padding: "12px 14px", fontSize: 15, width: "100%", boxSizing: "border-box", outline: "none" },
  hint: { fontSize: 13, color: "#54625D", marginTop: 14 },
  list: { marginTop: 14, display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #D9DFD3", borderRadius: 8, padding: "12px 16px", cursor: "pointer" },
  name: { fontWeight: 600, fontSize: 14 },
  meta: { fontSize: 12, color: "#54625D", fontFamily: "IBM Plex Mono, monospace", marginTop: 2 },
  arrow: { color: "#54625D" },
};
