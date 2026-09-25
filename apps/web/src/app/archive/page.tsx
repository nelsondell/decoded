import { Suspense } from "react";
import Link from "next/link";
import { CategoryFilter } from "@/components/category-filter";
import { FeedList } from "@/components/feed-list";
import { PaperCardSkeleton, PaperList } from "@/components/paper-card";
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
import { categoryLabel } from "@/lib/format";
import { api } from "@/lib/api";

export const metadata = {
  title: "The archive",
  description:
    "Every paper Decoded has pulled from arXiv, ranked by community signal. Filter by field or show only decoded papers.",
};

/**
 * O índice completo. A capa mostra seis offprints; aqui fica tudo o que
 * entrou, com filtro por categoria e rolagem infinita.
 */
export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; decoded?: string }>;
}) {
  const params = await searchParams;
  const category = params.category;
  const decodedOnly = params.decoded === "1";

  let initialData;
  let error: string | null = null;

  try {
    initialData = await api.getFeed({ limit: 20, category, decodedOnly });
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const countCaption = [
    decodedOnly ? "decoded papers" : "papers",
    category ? `in ${categoryLabel(category)}` : "across cs.AI, cs.CL, cs.LG and cs.CV",
  ].join(" ");

  return (
    <PageShell>
      <Masthead
        kicker={
          <span>
            The index
            {initialData ? ` · ${initialData.total.toLocaleString("en-US")}` : ""}
          </span>
        }
        title="The archive"
        lead="Every paper pulled from arXiv, in community-signal order. Decoded ones carry a sixty-second read, a deep dive, figures explained and analogies that name where they break."
      />

      <Column>
        <Suspense fallback={<div className="op-tabs h-[calc(40*var(--px))]" />}>
          <CategoryFilter />
        </Suspense>

        <div className="mt-[calc(40*var(--px))]">
          {error ? (
            <ErrorNote title="API unreachable" message={error} />
          ) : initialData ? (
            <Suspense
              fallback={
                <PaperList>
                  <PaperCardSkeleton />
                  <PaperCardSkeleton />
                  <PaperCardSkeleton />
                </PaperList>
              }
            >
              <FeedList
                initialData={initialData}
                category={category}
                decodedOnly={decodedOnly}
              />
            </Suspense>
          ) : null}
        </div>
      </Column>

      {initialData && (
        <Rail>
          <RailHeading>The index</RailHeading>

          <RailBlock>
            <div className="op-stat-value mt-0">
              {initialData.total.toLocaleString("en-US")}
            </div>
            <p className="op-rail-note mt-[calc(10*var(--px))]">{countCaption}</p>
          </RailBlock>

          <RailBlock className="flex flex-col items-start gap-[calc(14*var(--px))]">
            <Link href="/pulse" className="op-link">
              What&apos;s heating up →
            </Link>
            <Link href="/topics" className="op-link">
              Every topic tracked →
            </Link>
            <Link href="/listen" className="op-link">
              Papers as audio →
            </Link>
          </RailBlock>

          <RailNote>
            Papers are ranked by community signal — Hacker News mentions and
            citation velocity — then decoded in that order. Anything already
            decoded stays free at a permanent URL.
          </RailNote>
        </Rail>
      )}
    </PageShell>
  );
}
