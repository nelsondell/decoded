"use client";

import type { PaperCard as PaperCardType } from "@/lib/api";
import { EVENTS, capture } from "@/lib/analytics";
import { RelativeTime } from "@/components/relative-time";
import { Redacted } from "@/components/brand";
import { Ledger, LedgerNum, LedgerRow, LedgerSkeleton } from "@/components/ledger";
import { categoryShort } from "@/lib/format";

export type LedgerStat = { value: string; unit: string; label: string };

/**
 * Um paper no livro de achados: o número principal à esquerda, em musgo;
 * título, frase e dados à direita. Paper sem decode mostra a tarja no
 * lugar do número.
 */
export function PaperCard({
  paper,
  source = "feed",
  position,
  stat,
}: {
  paper: PaperCardType;
  source?: string;
  position?: number;
  /** Número vindo de fora (a capa busca o detalhe); senão, o do card. */
  stat?: LedgerStat | null;
}) {
  const finding = stat ?? paper.stat ?? null;
  const categories = paper.categories ?? [];

  return (
    <LedgerRow
      href={`/paper/${paper.arxiv_id}`}
      onClick={() =>
        capture(EVENTS.PAPER_VIEWED, {
          arxiv_id: paper.arxiv_id,
          source,
          position,
          is_decoded: paper.is_decoded,
          priority_score: paper.priority_score,
        })
      }
      num={
        finding ? (
          <LedgerNum value={finding.value} unit={finding.unit} label={finding.label} />
        ) : paper.is_decoded ? (
          <span className="op-ledger-label" data-on="">
            Decoded
          </span>
        ) : (
          <>
            <Redacted seed={position ?? 0} width={72} />
            <span className="op-ledger-label">Not decoded yet</span>
          </>
        )
      }
      title={paper.title}
      hook={paper.one_sentence}
      meta={
        <>
          <RelativeTime iso={paper.published_at} className="tnum" />
          {categories.slice(0, 2).map((c) => (
            <span key={c}>{categoryShort(c)}</span>
          ))}
          {paper.hn_mentions > 0 && <span className="tnum">HN ×{paper.hn_mentions}</span>}
        </>
      }
    />
  );
}

export const PaperCardSkeleton = LedgerSkeleton;

/** A lista de papers: o livro com as colunas "Finding" e "Paper". */
export function PaperList({ children }: { children: React.ReactNode }) {
  return <Ledger>{children}</Ledger>;
}
