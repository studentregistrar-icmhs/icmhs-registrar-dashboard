import Link from "next/link";
import { notFound } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { getTerm, TERMS } from "@/lib/terms";
import { loadTermData } from "@/lib/loadTermData";

export const revalidate = Number(process.env.REVALIDATE_SECONDS ?? 120);

export function generateStaticParams() {
  return TERMS.map((t) => ({ term: t.slug }));
}

export default async function TermPage({ params }: { params: { term: string } }) {
  const term = getTerm(params.term);
  if (!term) notFound();

  const data = await loadTermData(params.term);
  if (!data) notFound();

  if (data.error) {
    return (
      <div style={notReadyStyles.page}>
        <Link href="/" style={notReadyStyles.backLink}>← All terms</Link>
        <h1 style={notReadyStyles.h1}>{term.label} isn't set up yet</h1>
        <p style={notReadyStyles.p}>{data.error}</p>
        <p style={notReadyStyles.p}>
          {term.source.kind === "live-statuslog"
            ? "Create the STATUS LOG tab in the Google Sheet (see README.md \u2014 “Setting up Sept–Dec 2026”) and this page will pick it up automatically."
            : "Check that this term's data source is configured correctly in lib/terms.ts."}
        </p>
      </div>
    );
  }

  return (
    <Dashboard
      initialData={data.dashboard}
      initialConflicts={data.conflicts}
      termLabel={term.label}
      isLive={data.isLive}
      apiTermSlug={params.term}
    />
  );
}

const notReadyStyles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: "#EEF1EA", color: "#122A28", padding: "48px 32px", minHeight: "100vh", boxSizing: "border-box", maxWidth: 640 },
  backLink: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#54625D", textDecoration: "none", display: "inline-block", marginBottom: 20 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 26, margin: "0 0 14px" },
  p: { fontSize: 14, color: "#54625D", lineHeight: 1.6, marginBottom: 10 },
};
