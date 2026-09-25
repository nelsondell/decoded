import type { Metadata } from "next";
import Link from "next/link";
import { TopicCard, TopicList } from "@/components/topics/topic-card";
import {
  Column,
  ErrorNote,
  Masthead,
  PageSection,
  PageShell,
  Rail,
  RailHeading,
  RailNote,
  WhereItBreaks,
} from "@/components/page-shell";
import { api } from "@/lib/api";
import { rethrowDuringRevalidation } from "@/lib/isr";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Field Pulse",
  description:
    "What's heating up and cooling down in AI research. Topics discovered automatically from arXiv, tracked week over week.",
};

function Group({
  label,
  hint,
  topics,
}: {
  label: string;
  hint: string;
  topics: React.ComponentProps<typeof TopicCard>["topic"][];
}) {
  if (topics.length === 0) return null;

  return (
    <PageSection label={<span className="text-accent">{label}</span>} aside={hint}>
      <TopicList>
        {topics.map((t) => (
          <TopicCard key={t.slug} topic={t} showKeywords={false} />
        ))}
      </TopicList>
    </PageSection>
  );
}

export default async function PulsePage() {
  let pulse;
  let error: string | null = null;

  try {
    pulse = await api.getPulse();
  } catch (e) {
    rethrowDuringRevalidation(e);
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <PageShell>
      <Masthead
        kicker={<span>Topics, week over week</span>}
        title="Field Pulse"
        lead="Topics discovered from what researchers are actually publishing — not from a taxonomy someone wrote once. Recounted every week."
        meta={
          pulse ? (
            <>
              <span className="tnum">{pulse.total_topics} topics</span>
              <span className="tnum">{pulse.total_papers} papers</span>
              <span className="tnum">{pulse.weeks_covered} weeks tracked</span>
            </>
          ) : undefined
        }
      />

      <Column>
        {error && <ErrorNote title="Pulse unavailable" message={error} />}

        {pulse && (
          <>
            <Group
              label="Heating up"
              hint="more papers than the four weeks before"
              topics={pulse.rising ?? []}
            />
            <Group
              label="Emerging"
              hint="no prior weeks to compare"
              topics={pulse.emerging ?? []}
            />
            <Group
              label="Cooling"
              hint="fewer papers than before"
              topics={pulse.cooling ?? []}
            />
            <Group
              label="Largest"
              hint="most papers, any trend"
              topics={pulse.largest ?? []}
            />

            <div className="mt-[calc(56*var(--px))]">
              <Link href="/topics" className="op-link" data-cur="open">
                All {pulse.total_topics} topics →
              </Link>
            </div>
          </>
        )}
      </Column>

      <Rail>
        <RailHeading>How topics are found</RailHeading>
        <RailNote>
          Abstracts are embedded, clustered, and labelled from the cluster&apos;s
          own vocabulary. Clusters that fall below a handful of papers in a week
          are dissolved.
        </RailNote>
        {pulse && (
          <WhereItBreaks className="mt-[calc(28*var(--px))]">
            {pulse.weeks_covered} weeks is a short baseline. A topic marked
            emerging may only be emerging inside our window.
          </WhereItBreaks>
        )}
      </Rail>
    </PageShell>
  );
}
