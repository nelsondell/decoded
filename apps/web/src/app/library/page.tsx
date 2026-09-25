"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PaperCardSkeleton, PaperList } from "@/components/paper-card";
import {
  Column,
  EmptyNote,
  Masthead,
  PageShell,
  Rail,
  RailHeading,
  RailNote,
} from "@/components/page-shell";
import { RelativeTime } from "@/components/relative-time";
import { useApi } from "@/lib/use-api";

interface SavedResponse {
  papers: Array<{
    arxiv_id: string;
    title: string;
    one_sentence: string | null;
    published_at: string;
    is_decoded: boolean;
  }>;
  total: number;
}

interface MeResponse {
  display_name: string | null;
  email: string | null;
  plan: string;
  credits_remaining: number;
  saved_count: number;
}

export default function LibraryPage() {
  const { authedFetch } = useApi();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => authedFetch<MeResponse>("/v1/me"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["library"],
    queryFn: () => authedFetch<SavedResponse>("/v1/me/saved"),
  });

  return (
    <PageShell>
      <Masthead
        kicker={<span>{me?.display_name ?? "Your shelf"}</span>}
        title="Library"
        lead="Papers you saved, with whatever layers have been decoded since."
        meta={
          me ? (
            <>
              <span>{me.plan} plan</span>
              <span className="tnum">{me.credits_remaining} credits</span>
              <span className="tnum">{me.saved_count} saved</span>
              <Link href="/settings" className="op-link">
                Settings →
              </Link>
            </>
          ) : undefined
        }
      />

      <Column>
        {isLoading && (
          <PaperList>
            <PaperCardSkeleton />
            <PaperCardSkeleton />
          </PaperList>
        )}

        {data && data.papers.length === 0 && (
          <EmptyNote label="Nothing saved yet">
            Save a paper from its page and it lands here.
          </EmptyNote>
        )}

        {data && data.papers.length > 0 && (
          <ul className="op-entries">
            {data.papers.map((p) => (
              <li key={p.arxiv_id} data-reveal="fade" data-delay="auto">
                <Link href={`/paper/${p.arxiv_id}`} className="op-entry" data-cur="read">
                  <span className="op-entry-body">
                    <span className="op-kicker op-label">
                      <span>arXiv:{p.arxiv_id}</span>
                      <RelativeTime iso={p.published_at} className="tnum" />
                      {p.is_decoded && <span className="text-accent">Decoded</span>}
                    </span>
                    <span className="op-entry-title block">{p.title}</span>
                    {p.one_sentence && (
                      <span className="op-entry-dek block">{p.one_sentence}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Column>

      <Rail>
        <RailHeading>What is kept</RailHeading>
        <RailNote>
          Saving a paper keeps the link, not a copy. When a paper gets more
          layers decoded, the saved entry gets them too.
        </RailNote>
      </Rail>
    </PageShell>
  );
}
