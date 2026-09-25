"use client";

import Link from "next/link";
import type { SearchHit } from "@/lib/api";
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

      <ul className="op-entries">
        {hits.map((hit, i) => (
          <li key={hit.arxiv_id} data-reveal="fade" data-delay="auto">
            <Link
              href={`/paper/${hit.arxiv_id}`}
              className="op-entry"
              data-cur="read"
              onClick={() =>
                capture(EVENTS.SEARCH_RESULT_CLICKED, {
                  arxiv_id: hit.arxiv_id,
                  position: i,
                  score: hit.score,
                  from_chunk: !!hit.snippet,
                })
              }
            >
              <span className="op-entry-body">
                <span className="op-kicker op-label">
                  <span>arXiv:{hit.arxiv_id}</span>
                  <RelativeTime iso={hit.published_at} className="tnum" />
                  {hit.section && <span>{hit.section}</span>}
                  <span className="tnum ml-auto">match {hit.score.toFixed(2)}</span>
                </span>

                <span className="op-entry-title block">{hit.title}</span>

                {hit.one_sentence && (
                  <span className="op-entry-dek block">{hit.one_sentence}</span>
                )}

                {hit.snippet && (
                  <span className="op-entry-dek block">
                    <span className="op-label mr-2">Matched on</span>
                    <mark className="op-mark">
                      {hit.snippet.length > 240
                        ? `${hit.snippet.slice(0, 240)}…`
                        : hit.snippet}
                    </mark>
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
