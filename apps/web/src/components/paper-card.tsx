"use client";

import Link from "next/link";
import type { PaperCard as PaperCardType } from "@/lib/api";
import { EVENTS, capture } from "@/lib/analytics";
import { RelativeTime } from "@/components/relative-time";
import { Redacted } from "@/components/brand";
import { categoryShort, compactNumber } from "@/lib/format";

/**
 * Uma entrada de lista no registro do Offprint: rótulo em mono, título em
 * Literata leve, a frase-resumo em ink-2. No hover a entrada anda 14px para
 * a direita e o título fica musgo — o gesto das linhas do arquivo na capa.
 */
export function PaperCard({
  paper,
  source = "feed",
  position,
}: {
  paper: PaperCardType;
  source?: string;
  position?: number;
}) {
  const categories = paper.categories ?? [];
  const authors = paper.authors ?? [];
  const layers = paper.decoded_sections ?? [];

  return (
    <li data-reveal="fade" data-delay="auto">
      <Link
        href={`/paper/${paper.arxiv_id}`}
        className="op-entry"
        data-cur="read"
        onClick={() =>
          capture(EVENTS.PAPER_VIEWED, {
            arxiv_id: paper.arxiv_id,
            source,
            position,
            is_decoded: paper.is_decoded,
            priority_score: paper.priority_score,
          })
        }
      >
        <span className="op-entry-body">
          <span className="op-kicker op-label">
            <span>arXiv:{paper.arxiv_id}</span>
            <RelativeTime iso={paper.published_at} className="tnum" />
            {categories.slice(0, 2).map((c) => (
              <span key={c}>{categoryShort(c)}</span>
            ))}
            {paper.is_decoded ? (
              <span className="text-accent">
                Decoded{layers.length > 0 && ` · ${layers.length} layers`}
              </span>
            ) : null}
          </span>

          <span className="op-entry-title block">{paper.title}</span>

          {paper.one_sentence ? (
            <span className="op-entry-dek block">{paper.one_sentence}</span>
          ) : (
            <span className="mt-[calc(14*var(--px))] flex items-center gap-[calc(18*var(--px))]">
              <Redacted seed={position ?? 0} width={120} />
              <span className="op-label">Not decoded yet</span>
            </span>
          )}

          {(authors.length > 0 || paper.citation_count > 0 || paper.hn_mentions > 0) && (
            <span className="op-entry-meta op-label">
              {authors.length > 0 && (
                <span className="min-w-0 truncate normal-case tracking-normal">
                  {authors[0]}
                  {authors.length > 1 && ` +${authors.length - 1}`}
                </span>
              )}
              {paper.citation_count > 0 && (
                <span className="tnum">
                  {compactNumber(paper.citation_count)} citations
                </span>
              )}
              {paper.hn_mentions > 0 && (
                <span className="tnum">HN ×{paper.hn_mentions}</span>
              )}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function PaperCardSkeleton() {
  return (
    <li className="border-t border-border py-[calc(30*var(--px))]" aria-hidden="true">
      <div className="h-3 w-44 animate-pulse bg-surface" />
      <div className="mt-4 h-7 w-4/5 animate-pulse bg-surface" />
      <div className="mt-3 h-4 w-3/5 animate-pulse bg-surface" />
    </li>
  );
}

/** A lista que recebe as entradas — fio embaixo da última. */
export function PaperList({ children }: { children: React.ReactNode }) {
  return <ul className="op-entries">{children}</ul>;
}
