import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AnalogiesBlock,
  DeepDiveBlock,
  FiguresBlock,
  OneSentenceBlock,
  Section,
  SixtySecondBlock,
  VocabularyBlock,
} from "@/components/decoded-sections";
import { OriginalAbstract } from "@/components/original-abstract";
import { PaperNav, type NavItem } from "@/components/paper-nav";
import { Column, Masthead, PageSection, PageShell, Rail } from "@/components/page-shell";
import { Plate } from "@/components/offprint/plate";
import { Redacted } from "@/components/brand";
import { Icon } from "@/components/icons";
import { ApiError, api } from "@/lib/api";
import { decoded } from "@/lib/decoded-types";
import { categoryShort, compactNumber } from "@/lib/format";
import { issueDate, paperFigure, readingMinutes } from "@/lib/offprint";
import { SaveButton } from "@/components/save-button";
import { PaperJsonLd } from "@/components/paper-json-ld";
import { SectionTracker } from "@/components/section-tracker";
import { MembersGate } from "@/components/visual/members-gate";
import { VisualOpen, memberTeaser, visualNav } from "@/components/visual/visual-paper";
import { visualOf, walkthroughOf } from "@/lib/visual-types";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ arxiv_id: string }>;
}): Promise<Metadata> {
  const { arxiv_id } = await params;

  try {
    const paper = await api.getPaper(arxiv_id);
    const decodedMap = paper.decoded ?? {};
    const one = decoded.oneSentence(decodedMap);
    const description = one?.text ?? visualOf(decodedMap)?.hook ?? paper.abstract.slice(0, 155);
    const url = `/paper/${arxiv_id}`;

    return {
      title: paper.title,
      description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title: paper.title,
        description,
        type: "article",
        url,
        publishedTime: paper.published_at,
        authors: (paper.authors ?? []).map((a) => a.name),
        tags: paper.categories ?? [],
      },
      twitter: {
        card: "summary_large_image",
        title: paper.title,
        description,
      },
    };
  } catch {
    return {
      title: "Paper not found",
      robots: { index: false, follow: false },
    };
  }
}

export default async function PaperPage({
  params,
}: {
  params: Promise<{ arxiv_id: string }>;
}) {
  const { arxiv_id } = await params;

  let paper;
  try {
    paper = await api.getPaper(arxiv_id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const decodedMap = paper.decoded ?? {};
  // Papers novos trazem a seção "visual"; os antigos, as seis em prosa
  const visual = visualOf(decodedMap);

  const one = decoded.oneSentence(decodedMap);
  const sixty = decoded.sixtySecond(decodedMap);
  const deep = decoded.deepDive(decodedMap);
  const figures = decoded.figures(decodedMap);
  const analogies = decoded.analogies(decodedMap);
  const vocab = decoded.vocabulary(decodedMap);

  const terms = vocab?.terms ?? [];
  const isDecoded = Object.keys(decodedMap).length > 0;
  // A figura de capa do decode visual sai dos resultados, que são da parte fechada
  const figure = visual ? null : paperFigure(paper);
  const authors = paper.authors ?? [];

  const navItems: NavItem[] = [
    ...(visual ? visualNav(visual) : []),
    !visual && one && { id: "tldr", label: "One sentence" },
    !visual && sixty && { id: "sixty", label: "60 seconds" },
    !visual && deep && { id: "deep", label: "Deep dive" },
    !visual && figures?.items.length && { id: "figures", label: "Figures" },
    !visual && analogies?.items.length && { id: "analogies", label: "Analogies" },
    !visual && terms.length && { id: "vocabulary", label: "Vocabulary" },
    { id: "modes", label: "Modes" },
    { id: "podcast", label: "Listen" },
  ].filter(Boolean) as NavItem[];
  const open = new Set(["tldr", "how", "sixty", "deep", "figures", "analogies", "vocabulary"]);
  const gated = navItems.map((n) => n.id).filter((id) => !open.has(id));

  return (
    <>
      <PaperJsonLd paper={paper} oneSentence={one?.text ?? visual?.hook ?? null} />
      <SectionTracker
        arxivId={paper.arxiv_id}
        sectionIds={navItems.map((n) => n.id)}
      />

      <PageShell>
        <Masthead
          back={{ href: "/", label: "Feed" }}
          title={paper.title}
          lead={
            authors.length > 0 ? (
              <span className="font-mono text-[length:var(--t-mono)] leading-[1.8] tracking-[0.04em] text-muted-foreground">
                {authors
                  .slice(0, 6)
                  .map((a) => a.name)
                  .join(", ")}
                {authors.length > 6 && ` +${authors.length - 6}`}
              </span>
            ) : undefined
          }
          meta={
            <>
              <span>arXiv:{paper.arxiv_id}</span>
              {(paper.categories ?? []).slice(0, 3).map((c) => (
                <span key={c}>{categoryShort(c)}</span>
              ))}
              <span className="tnum">{issueDate(new Date(paper.published_at))}</span>
              <span className="tnum">{readingMinutes(paper)} min read</span>
              {paper.citation_count > 0 && (
                <span className="tnum">{compactNumber(paper.citation_count)} citations</span>
              )}
              {paper.hn_url ? (
                <a href={paper.hn_url} target="_blank" rel="noopener noreferrer" className="op-link tnum">
                  HN ×{paper.hn_mentions}
                </a>
              ) : (
                paper.hn_mentions > 0 && <span className="tnum">HN ×{paper.hn_mentions}</span>
              )}
              <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="op-link">
                PDF <Icon name="arrow-out" />
              </a>
              <SaveButton arxivId={paper.arxiv_id} />
            </>
          }
          aside={figure ? <Plate figure={figure} side="right" /> : undefined}
          plate={!!figure}
        />

        <Column>
          {!isDecoded && (
            <PageSection label="Not decoded yet" aside="in the queue">
              <div data-reveal="fade" data-delay="80">
                <Redacted width={280} className="mb-[calc(22*var(--px))]" />
                <p className="op-big">
                  This paper is waiting its turn. The original abstract is at
                  the bottom of the page.
                </p>
              </div>
            </PageSection>
          )}

          {visual && <VisualOpen v={visual} walkthrough={walkthroughOf(decodedMap)} />}

          {!visual && one && (
            <Section id="tldr" label="One sentence">
              <OneSentenceBlock data={one} />
            </Section>
          )}

          {!visual && sixty && (
            <Section id="sixty" label="60-second read" aside="three parts">
              <SixtySecondBlock data={sixty} terms={terms} />
            </Section>
          )}

          {!visual && deep && (
            <Section id="deep" label="Deep dive" aside="five sections">
              <DeepDiveBlock data={deep} terms={terms} />
            </Section>
          )}

          {!visual && figures && figures.items.length > 0 && (
            <Section id="figures" label="Figures explained" aside={`${figures.items.length} fig.`}>
              <FiguresBlock data={figures} />
            </Section>
          )}

          {!visual && analogies && analogies.items.length > 0 && (
            <Section id="analogies" label="Analogies">
              <AnalogiesBlock data={analogies} />
            </Section>
          )}

          {!visual && vocab && vocab.terms.length > 0 && (
            <Section id="vocabulary" label="Vocabulary" aside={`${vocab.terms.length} terms`}>
              <VocabularyBlock data={vocab} />
            </Section>
          )}

          <MembersGate
            arxivId={paper.arxiv_id}
            teaser={visual ? memberTeaser(visual) : null}
            anchors={gated}
          />

          <OriginalAbstract abstract={paper.abstract} />
        </Column>

        {navItems.length > 0 && (
          <Rail>
            <PaperNav items={navItems} />
          </Rail>
        )}
      </PageShell>
    </>
  );
}
