/**
 * Every term the dashboard knows about, and where its data comes from.
 * Add a new term here — no other file needs to change for it to show up
 * in the nav and be reachable at /terms/<slug>.
 */
export type TermSource =
  | { kind: "live-legacy"; block: "flagsJanApr" | "flagsMayAug" }
  | { kind: "live-statuslog"; termLabel: string } // matches the "Term" column in the STATUS LOG tab
  | { kind: "static"; file: string }; // path under /data/historical/

export type TermConfig = {
  slug: string;
  label: string;
  source: TermSource;
  isDefault?: boolean;
};

export const TERMS: TermConfig[] = [
  {
    slug: "jan-apr-2026",
    label: "Jan – Apr 2026",
    source: { kind: "live-legacy", block: "flagsJanApr" },
  },
  {
    slug: "may-aug-2026",
    label: "May – Aug 2026",
    source: { kind: "live-legacy", block: "flagsMayAug" },
    isDefault: true,
  },
  {
    slug: "sept-dec-2026",
    label: "Sept – Dec 2026",
    source: { kind: "live-statuslog", termLabel: "SEPT-DEC 2026" },
  },
  // Previous years land here once their Excel files are parsed, e.g.:
  // {
  //   slug: "jan-apr-2025",
  //   label: "Jan – Apr 2025",
  //   source: { kind: "static", file: "jan-apr-2025.json" },
  // },
];

export function getTerm(slug: string): TermConfig | undefined {
  return TERMS.find((t) => t.slug === slug);
}

/** The term immediately before this one in TERMS (chronological order),
 * or undefined if this is the first term on record. Powers the
 * term-over-term trend card on the dashboard. */
export function getPreviousTerm(slug: string): TermConfig | undefined {
  const i = TERMS.findIndex((t) => t.slug === slug);
  if (i <= 0) return undefined;
  return TERMS[i - 1];
}

export function getDefaultTerm(): TermConfig {
  return TERMS.find((t) => t.isDefault) ?? TERMS[0];
}
