import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PaperCard, PaperList } from "@/components/paper-card";
import { TimelineChart } from "@/components/topics/timeline-chart";
import {
  Column,
  EmptyNote,
  Masthead,
  PageSection,
  PageShell,
  Rail,
  RailHeading,
  RailNote,
  Stat,
  Stats,
  WhereItBreaks,
} from "@/components/page-shell";
import { ApiError, api } from "@/lib/api";
import { FollowButton } from "@/components/follow-button";

export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const topic = await api.getTopic(slug);
    return {
      title: topic.name,
      description:
        topic.description ??
        `${topic.paper_count} papers on ${topic.name}, decoded for humans.`,
    };
  } catch {
    return { title: "Topic not found", robots: { index: false } };
  }
}

const MOMENTUM_COPY: Record<string, string> = {
  rising: "Heating up",
  cooling: "Cooling down",
  steady: "Steady",
  new: "New topic",
  quiet: "Quiet",
};

function formatMomentum(label: string, value: number): string {
  if (label === "new") return "new";
  const pct = Math.round(value * 100);
  if (pct === 0) return "0%";
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let topic;
  try {
    topic = await api.getTopic(slug, 12);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const keywords = topic.keywords ?? [];
  const timeline = topic.timeline ?? [];
  const authors = topic.top_authors ?? [];
  const papers = topic.papers ?? [];

  return (
    <PageShell>
      <Masthead
        back={{ href: "/topics", label: "Topics" }}
        kicker={
          <>
            <span>Topic</span>
            {keywords.slice(0, 5).map((k) => (
              <span key={k}>{k}</span>
            ))}
          </>
        }
        title={topic.name}
        lead={topic.description ?? undefined}
        aside={<FollowButton targetType="topic" slug={topic.slug} />}
      />

      <Column>
        <Stats>
          <Stat label="Papers" value={topic.paper_count} />
          <Stat label="Last 4 weeks" value={topic.recent_papers} />
          <Stat
            label={MOMENTUM_COPY[topic.momentum_label] ?? "Trend"}
            tone={
              topic.momentum_label === "rising" || topic.momentum_label === "new"
                ? "accent"
                : topic.momentum_label === "cooling"
                  ? "muted"
                  : "default"
            }
            value={formatMomentum(topic.momentum_label, topic.momentum)}
          />
        </Stats>

        <PageSection label="Papers per week" aside={`last ${timeline.length} weeks`}>
          <TimelineChart points={timeline} />
        </PageSection>

        {authors.length > 0 && (
          <PageSection label="Most active authors">
            <ul className="op-archive-list">
              {authors.map((a) => (
                <li key={a.name} data-reveal="fade" data-delay="auto">
                  <div className="op-row" data-size="s" data-static="">
                    <span className="op-row-main">
                      <span>{a.name}</span>
                      {a.affiliation && <span className="op-row-sub">{a.affiliation}</span>}
                    </span>
                    <span className="op-row-count">
                      {a.paper_count} papers
                      {a.total_citations > 0 && ` · ${a.total_citations} cites`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </PageSection>
        )}

        <PageSection label="Papers" aside={`${papers.length} shown`}>
          {papers.length > 0 ? (
            <PaperList>
              {papers.map((p, i) => (
                <PaperCard key={p.arxiv_id} paper={p} source="topic" position={i} />
              ))}
            </PaperList>
          ) : (
            <EmptyNote label="No papers listed">
              The index hasn&apos;t linked any papers here yet. It rebuilds weekly.
            </EmptyNote>
          )}
        </PageSection>
      </Column>

      <Rail>
        <RailHeading>How this topic was found</RailHeading>
        <RailNote>
          Abstracts are embedded and clustered; the name comes from the
          cluster&apos;s own vocabulary, not from a taxonomy.
        </RailNote>
        <WhereItBreaks className="mt-[calc(28*var(--px))]">
          A paper sits in one cluster even when it belongs in two. Work that
          straddles subfields will be under-counted here.
        </WhereItBreaks>
      </Rail>
    </PageShell>
  );
}
