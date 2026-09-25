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
    const a = await api.getAuthor(slug);
    return {
      title: a.name,
      description: `${a.paper_count} papers by ${a.name}${
        a.affiliation ? ` at ${a.affiliation}` : ""
      }, decoded for humans.`,
    };
  } catch {
    return { title: "Author not found", robots: { index: false } };
  }
}

function formatYear(iso: string | null | undefined): string {
  return iso ? new Date(iso).getUTCFullYear().toString() : "—";
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let author;
  try {
    author = await api.getAuthor(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const topics = author.topics ?? [];
  const coauthors = author.coauthors ?? [];
  const papers = author.papers ?? [];
  const first = formatYear(author.first_paper_at);
  const latest = formatYear(author.latest_paper_at);

  return (
    <PageShell>
      <Masthead
        back={{ href: "/authors", label: "Authors" }}
        kicker={
          <>
            <span>Author</span>
            {!author.is_disambiguated && <span>name match</span>}
          </>
        }
        title={author.name}
        lead={
          author.affiliation ? (
            author.institution_slug ? (
              <Link href={`/institution/${author.institution_slug}`}>
                {author.affiliation}
              </Link>
            ) : (
              author.affiliation
            )
          ) : undefined
        }
        aside={
          <FollowButton
            targetType="author"
            slug={author.slug}
            initialFollowing={author.is_following}
          />
        }
      />

      <Column>
        <Stats>
          <Stat label="Papers" value={author.paper_count} />
          <Stat label="Citations" value={author.total_citations} />
          <Stat label="Active" value={first !== latest ? `${first}–${latest}` : first} />
        </Stats>

        {topics.length > 0 && (
          <PageSection label="Works on">
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

        {coauthors.length > 0 && (
          <PageSection label="Frequent collaborators">
            <ul className="op-archive-list">
              {coauthors.map((c) => (
                <li key={c.slug} data-reveal="fade" data-delay="auto">
                  <Link href={`/author/${c.slug}`} className="op-row" data-size="s" data-cur="open">
                    <span>{c.name}</span>
                    <span className="op-row-count">{c.shared_papers} together</span>
                  </Link>
                </li>
              ))}
            </ul>
          </PageSection>
        )}

        <PageSection label="Papers" aside={`${papers.length} shown`}>
          {papers.length > 0 ? (
            <PaperList>
              {papers.map((p, i) => (
                <PaperCard key={p.arxiv_id} paper={p} source="author" position={i} />
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
          Everything here comes from the papers themselves: affiliations as the
          paper declared them, collaborators as they appear on the byline.
        </RailNote>
        {!author.is_disambiguated && (
          <WhereItBreaks className="mt-[calc(28*var(--px))]">
            This page is grouped by name. Papers by different researchers who
            share this name may be mixed together.
          </WhereItBreaks>
        )}
      </Rail>
    </PageShell>
  );
}
