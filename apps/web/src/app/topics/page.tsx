import type { Metadata } from "next";
import Link from "next/link";
import { TopicCard, TopicList } from "@/components/topics/topic-card";
import {
  Column,
  Masthead,
  PageShell,
  Rail,
  RailHeading,
  RailNote,
} from "@/components/page-shell";
import { api } from "@/lib/api";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Topics",
  description: "Every research topic Decoded tracks, discovered by clustering.",
};

const SORTS = [
  { key: "size", label: "Size" },
  { key: "momentum", label: "Momentum" },
  { key: "name", label: "A–Z" },
] as const;

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort = "size" } = await searchParams;

  const data = await api.getTopics({ sort, limit: 200 });

  return (
    <PageShell>
      <Masthead
        kicker={<span>The index · {data.total}</span>}
        title="Topics"
        lead="Discovered by clustering paper embeddings rather than assigned by hand, so the names read like the papers, not like a catalogue."
      />

      <Column>
        <nav className="op-tabs" aria-label="Sort topics">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/topics?sort=${s.key}`}
              className="op-nav-link"
              aria-current={sort === s.key ? "page" : undefined}
            >
              {s.label}
            </Link>
          ))}
          <Link href="/pulse" className="op-nav-link op-tabs-aside">
            Field Pulse →
          </Link>
        </nav>

        <div className="mt-[calc(40*var(--px))]">
          <TopicList>
            {(data.topics ?? []).map((t) => (
              <TopicCard key={t.slug} topic={t} />
            ))}
          </TopicList>
        </div>
      </Column>

      <Rail>
        <RailHeading>How topics are found</RailHeading>
        <RailNote>
          Abstracts are embedded and clustered; each cluster is labelled from its
          own vocabulary. Nothing here comes from a taxonomy someone wrote once.
        </RailNote>
      </Rail>
    </PageShell>
  );
}
