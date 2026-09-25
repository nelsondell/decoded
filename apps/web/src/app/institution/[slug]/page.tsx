import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FollowButton } from "@/components/follow-button";
import { PaperCard, PaperList } from "@/components/paper-card";
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

export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const i = await api.getInstitution(slug);
    return {
      title: i.name,
      description: `${i.paper_count} papers from ${i.name}, decoded for humans.`,
    };
  } catch {
    return { title: "Institution not found", robots: { index: false } };
  }
}

export default async function InstitutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let inst;
  try {
    inst = await api.getInstitution(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const authors = inst.top_authors ?? [];
  const topics = inst.topics ?? [];
  const papers = inst.papers ?? [];

  return (
    <PageShell>
      <Masthead
        back={{ href: "/institutions", label: "Institutions" }}
        kicker={
          <>
            <span>Institution</span>
            {inst.country_code && <span>{inst.country_code}</span>}
          </>
        }
        title={inst.name}
        aside={
          <FollowButton
            targetType="institution"
            slug={inst.slug}
            initialFollowing={inst.is_following}
          />
        }
      />

      <Column>
        <Stats>
          <Stat label="Papers" value={inst.paper_count} />
          <Stat label="Authors" value={inst.author_count} />
          <Stat label="Citations" value={inst.total_citations} />
        </Stats>

        {topics.length > 0 && (
          <PageSection label="Research areas">
            <ul className="op-archive-list">
              {topics.map((t) => (
                <li key={t.slug} data-reveal="fade" data-delay="auto">
                  <Link href={`/topic/${t.slug}`} className="op-row" data-size="s" data-cur="open">
                    <span>{t.name}</span>
                    <span className="op-row-count">{t.paper_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </PageSection>
        )}

        {authors.length > 0 && (
          <PageSection label="Researchers">
            <ul className="op-archive-list">
              {authors.map((a) => (
                <li key={a.slug} data-reveal="fade" data-delay="auto">
                  <Link href={`/author/${a.slug}`} className="op-row" data-size="s" data-cur="open">
                    <span>{a.name}</span>
                    <span className="op-row-count">{a.paper_count} papers</span>
                  </Link>
                </li>
              ))}
            </ul>
          </PageSection>
        )}

        <PageSection label="Recent papers" aside={`${papers.length} shown`}>
          {papers.length > 0 ? (
            <PaperList>
              {papers.map((p, i) => (
                <PaperCard key={p.arxiv_id} paper={p} source="institution" position={i} />
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
        <RailHeading>How this page is built</RailHeading>
        <RailNote>
          Papers are attributed from the affiliations printed on them, then
          grouped by normalised institution name.
        </RailNote>
        <WhereItBreaks className="mt-[calc(28*var(--px))]">
          A lab that publishes under several names — a university, a department,
          a spin-out — can show up as more than one institution here.
        </WhereItBreaks>
      </Rail>
    </PageShell>
  );
}
