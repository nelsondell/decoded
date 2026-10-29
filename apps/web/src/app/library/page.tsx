"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LedgerRow } from "@/components/ledger";
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
import { Icon } from "@/components/icons";

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
        title="Library"
        lead="Papers you saved, with whatever layers have been decoded since."
        meta={
          me ? (
            <>
              {me.display_name && <span>{me.display_name}</span>}
              <span>{me.plan} plan</span>
              <span className="tnum">{me.credits_remaining} credits</span>
              <span className="tnum">{me.saved_count} saved</span>
              <Link href="/settings" className="op-link">
                Settings <Icon name="arrow-right" />
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
          <PaperList>
            {data.papers.map((p) => (
              <LedgerRow
                key={p.arxiv_id}
                href={`/paper/${p.arxiv_id}`}
                num={
                  <span className="op-ledger-label" data-on={p.is_decoded ? "" : undefined}>
                    {p.is_decoded ? "Decoded" : "Not decoded yet"}
                  </span>
                }
                title={p.title}
                hook={p.one_sentence}
                meta={
                  <>
                    <RelativeTime iso={p.published_at} className="tnum" />
                    <span>arXiv:{p.arxiv_id}</span>
                  </>
                }
              />
            ))}
          </PaperList>
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
