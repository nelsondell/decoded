"use client";

import type { SearchHit } from "@/lib/api";
import { Ledger, LedgerNum, LedgerRow } from "@/components/ledger";
import { EmptyNote, SectionHead } from "@/components/page-shell";
import { RelativeTime } from "@/components/relative-time";
import { EVENTS, capture } from "@/lib/analytics";

/*
  Componente de cliente: registra o clique no resultado. Renderizado a
  partir de um server component, precisa da diretiva para poder passar
  onClick ao Link.
*/
export function SearchResults({
  hits,
  reranked,
  latencyMs,
  totalFound,
}: {
  hits: SearchHit[];
  reranked: boolean;
  latencyMs: number;
  totalFound: number;
}) {
  if (hits.length === 0) {
    return (
      <div className="mt-[calc(56*var(--px))]">
        <EmptyNote label="No results">
          Nothing in the decoded archive matched that. Search runs over the
          explanations, not the raw PDFs.
        </EmptyNote>
      </div>
    );
  }

  return (
    <div className="mt-[calc(72*var(--px))]">
      <SectionHead
        label={`${hits.length} of ${totalFound} candidates`}
        aside={`${reranked ? "ranked by passage match" : "ranked by similarity"} · ${latencyMs}ms`}
      />

      <Ledger columns={["Match", "Paper"]}>
        {hits.map((hit, i) => (
          <LedgerRow
            key={hit.arxiv_id}
            href={`/paper/${hit.arxiv_id}`}
            onClick={() =>
              capture(EVENTS.SEARCH_RESULT_CLICKED, {
                arxiv_id: hit.arxiv_id,
                position: i,
                score: hit.score,
                from_chunk: !!hit.snippet,
              })
            }
            num={<LedgerNum value={hit.score.toFixed(2)} label={hit.section ?? "match"} />}
            title={hit.title}
            hook={
              hit.snippet ? (
                <>
                  {hit.one_sentence && <span className="block">{hit.one_sentence}</span>}
                  <mark className="op-mark mt-[calc(8*var(--px))] inline-block">
                    {hit.snippet.length > 240 ? `${hit.snippet.slice(0, 240)}…` : hit.snippet}
                  </mark>
                </>
              ) : (
                hit.one_sentence
              )
            }
            meta={
              <>
                <RelativeTime iso={hit.published_at} className="tnum" />
                <span>arXiv:{hit.arxiv_id}</span>
              </>
            }
          />
        ))}
      </Ledger>
    </div>
  );
}
