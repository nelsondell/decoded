import type { Metadata } from "next";
import { CopyField } from "@/components/copy-field";
import { Ledger, LedgerNum, LedgerRow } from "@/components/ledger";
import {
  Column,
  EmptyNote,
  Masthead,
  PageSection,
  PageShell,
  Rail,
  RailHeading,
  RailNote,
  WhereItBreaks,
} from "@/components/page-shell";
import { issueDate } from "@/lib/offprint";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Listen",
  description:
    "Every decoded paper as three to eight minutes of audio. Subscribe in any podcast app.",
};

interface Episode {
  arxiv_id: string;
  title: string;
  one_sentence: string | null;
  audio_url: string;
  duration_seconds: number;
  published_at: string;
}

async function getEpisodes(): Promise<Episode[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/podcasts?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: { episodes: Episode[] } = await res.json();
    return data.episodes ?? [];
  } catch {
    return [];
  }
}

export default async function ListenPage() {
  const episodes = await getEpisodes();
  const minutes = Math.round(
    episodes.reduce((a, ep) => a + ep.duration_seconds, 0) / 60,
  );

  return (
    <PageShell>
      <Masthead
        title="Listen"
        lead="Every decoded paper as three to eight minutes of audio. Written for the ear — no diagrams, no notation, nothing you need to see."
        meta={
          episodes.length > 0 ? (
            <>
              <span className="tnum">
                {episodes.length} episode{episodes.length === 1 ? "" : "s"}
              </span>
              <span className="tnum">{minutes} min</span>
            </>
          ) : undefined
        }
      />

      <Column>
        <PageSection label="Subscribe" aside="any podcast app">
          <div data-reveal="fade" data-delay="80">
            <p className="op-prose op-prose-2 mb-[calc(22*var(--px))] mt-0">
              Paste this into Overcast, Pocket Casts, or anything that reads RSS.
            </p>
            <CopyField value={`${SITE_URL}/feed.xml`} />
          </div>
        </PageSection>

        <PageSection label="Latest episodes">
          {episodes.length === 0 ? (
            <EmptyNote label="No episodes yet">
              Episodes appear here as papers are decoded and read aloud.
            </EmptyNote>
          ) : (
            <Ledger columns={["Length", "Episode"]}>
              {episodes.map((ep) => (
                <LedgerRow
                  key={ep.arxiv_id}
                  href={`/paper/${ep.arxiv_id}#podcast`}
                  num={<LedgerNum value={Math.round(ep.duration_seconds / 60)} unit="min" />}
                  title={ep.title}
                  hook={ep.one_sentence}
                  meta={
                    <>
                      <span className="tnum">{issueDate(new Date(ep.published_at))}</span>
                      <span>arXiv:{ep.arxiv_id}</span>
                    </>
                  }
                />
              ))}
            </Ledger>
          )}
        </PageSection>
      </Column>

      <Rail>
        <RailHeading>Written for the ear</RailHeading>
        <RailNote>
          The audio script is not the article read aloud. Equations become
          sentences, figures become descriptions, and section numbers are
          dropped.
        </RailNote>
        <WhereItBreaks className="mt-[calc(28*var(--px))]">
          Diagram-heavy papers lose the most. When a figure carries the
          argument, the episode says so and points you back to the page.
        </WhereItBreaks>
      </Rail>
    </PageShell>
  );
}
