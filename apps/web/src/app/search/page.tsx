import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { SearchResults } from "@/components/search-results";
import {
  Column,
  ErrorNote,
  Masthead,
  PageShell,
  Rail,
  RailBlock,
  RailHeading,
  RailNote,
} from "@/components/page-shell";
import { api } from "@/lib/api";

export const metadata = {
  title: "Search",
  description: "Semantic search across decoded AI research papers.",
  robots: { index: true, follow: true },
};

const SEARCHED = [
  "one-sentence layer",
  "60-second read",
  "deep dive sections",
  "figure explanations",
  "vocabulary entries",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <PageShell>
      <Masthead
        kicker={<span>Across every decoded layer</span>}
        title="Search"
        lead="Ask the way you would ask a person. Results quote the passage they matched."
      />

      <Column>
        <Suspense fallback={<div className="op-search h-[calc(72*var(--px))]" />}>
          <SearchBox autoFocus />
        </Suspense>

        {q && (
          <Suspense
            key={q}
            fallback={<p className="op-label mt-[calc(56*var(--px))]">Searching…</p>}
          >
            <Results query={q} />
          </Suspense>
        )}
      </Column>

      <Rail>
        <RailHeading>What is searched</RailHeading>
        <RailBlock className="flex flex-col gap-2.5 font-mono text-[length:var(--t-mono)] font-light text-muted-foreground">
          {SEARCHED.map((item) => (
            <span key={item}>{item}</span>
          ))}
          <span className="text-subtle">not the raw PDF</span>
        </RailBlock>
        <RailNote>
          Results quote the passage they matched, so you can judge the hit before
          you open it.
        </RailNote>
      </Rail>
    </PageShell>
  );
}

async function Results({ query }: { query: string }) {
  try {
    const res = await api.search({ q: query, limit: 10 });

    return (
      <SearchResults
        hits={res.hits ?? []}
        reranked={res.reranked}
        latencyMs={res.latency_ms}
        totalFound={res.total_found}
      />
    );
  } catch (e) {
    return (
      <div className="mt-[calc(56*var(--px))]">
        <ErrorNote
          title="Search failed"
          message={e instanceof Error ? e.message : "Unknown error"}
        />
      </div>
    );
  }
}
