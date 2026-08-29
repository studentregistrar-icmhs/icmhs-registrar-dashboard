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
