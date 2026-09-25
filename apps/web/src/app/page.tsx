import { Fragment } from "react";
import Link from "next/link";
import { OffprintLink } from "@/components/offprint/offprint-link";
import { OffprintMotion } from "@/components/offprint/offprint-motion";
import { Plate } from "@/components/offprint/plate";
import { api, type PaperCard, type PaperDetail } from "@/lib/api";
import { categoryLabel } from "@/lib/format";
import { rethrowDuringRevalidation } from "@/lib/isr";
import {
  buildOffprints,
  countWord,
  issueDate,
  issueNumber,
  OFFPRINTS_PER_ISSUE,
  pad2,
  titleSize,
  type Offprint,
} from "@/lib/offprint";

export const revalidate = 300; // ISR: a edição se refaz a cada 5 min

const CATEGORIES = ["cs.CL", "cs.LG", "cs.CV", "cs.AI"] as const;

type ArchiveRow = { href: string; label: string; count: number };

type Issue = {
  offprints: Offprint[];
  archiveTotal: number;
  archive: ArchiveRow[];
};

async function loadIssue(): Promise<Issue> {
  const [decodedFeed, fullFeed, topics] = await Promise.all([
    api.getFeed({ limit: 20, decodedOnly: true }),
    api.getFeed({ limit: 20 }),
    api.getTopics({ sort: "size", limit: 6 }).catch(() => null),
  ]);

  const picks = dedupe([...decodedFeed.papers, ...fullFeed.papers]).slice(
    0,
    OFFPRINTS_PER_ISSUE,
  );
  const details = new Map<string, PaperDetail>();
  const settled = await Promise.allSettled(picks.map((p) => api.getPaper(p.arxiv_id)));
  settled.forEach((r) => {
    if (r.status === "fulfilled") details.set(r.value.arxiv_id, r.value);
  });

  let archive: ArchiveRow[] = (topics?.topics ?? []).map((t) => ({
    href: `/topic/${t.slug}`,
    label: t.name,
    count: t.paper_count,
  }));

  // Sem tópicos ainda (clustering não rodou): as categorias do arXiv
  if (archive.length === 0) {
    const counts = await Promise.allSettled(
      CATEGORIES.map((c) => api.getFeed({ limit: 1, category: c })),
    );
    archive = CATEGORIES.map((c, i) => {
      const r = counts[i];
      return {
        href: `/archive?category=${c}`,
        label: categoryLabel(c),
        count: r.status === "fulfilled" ? r.value.total : 0,
      };
    }).filter((row) => row.count > 0);
  }

  return {
    offprints: buildOffprints(decodedFeed.papers, fullFeed.papers, details),
    archiveTotal: fullFeed.total,
    archive,
  };
}

function dedupe(papers: PaperCard[]): PaperCard[] {
  const seen = new Set<string>();
  return papers.filter((p) => (seen.has(p.arxiv_id) ? false : (seen.add(p.arxiv_id), true)));
}

/** Uma linha que sobe de dentro da própria máscara. */
function Line({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <span className="op-mask">
      <span data-reveal="line" data-delay={delay}>
        {children}
      </span>
    </span>
  );
}

function OffprintSection({ offprint, index }: { offprint: Offprint; index: number }) {
  const side = index % 2 === 0 ? "left" : "right";
  const words = offprint.title.split(/\s+/).filter(Boolean);

  return (
    <section
      id={index === 0 ? "today" : undefined}
      data-count={pad2(index + 1)}
      data-stack=""
      className="op-grid op-print"
    >
      {side === "left" && <Plate figure={offprint.figure} side="left" />}

      <div className="op-copy" data-side={side === "left" ? "right" : "left"}>
        <div className="op-label" data-reveal="fade" data-delay="120">
          {offprint.kicker}
        </div>
        {/* Máscara por palavra; OffprintMotion agrupa as palavras pela linha
            em que caíram e escalona 90ms por linha, como no protótipo */}
        <h2
          className="op-title"
          data-size={titleSize(offprint.title)}
          data-line-stagger="180,90"
        >
          {words.map((word, i) => (
            <Fragment key={i}>
              <span className="op-mask op-mask--word">
                <span data-reveal="line" data-delay="180">
                  {word}
                </span>
              </span>
              {i < words.length - 1 && " "}
            </Fragment>
          ))}
        </h2>
        {offprint.dek && (
          <p className="op-dek" data-reveal="fade" data-delay="380">
            {offprint.dek}
          </p>
        )}
        <OffprintLink
          arxivId={offprint.arxivId}
          position={index}
          decoded={offprint.decoded}
        >
          {offprint.decoded ? "Read the offprint →" : "Read the abstract →"}
        </OffprintLink>
      </div>

      {side === "right" && <Plate figure={offprint.figure} side="right" />}
    </section>
  );
}

export default async function Home() {
  const now = new Date();
  const date = issueDate(now);

  let issue: Issue | null = null;
  let error: string | null = null;
  try {
    issue = await loadIssue();
  } catch (e) {
    rethrowDuringRevalidation(e);
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const offprints = issue?.offprints ?? [];
  const minutes = Math.max(
    1,
    Math.round(offprints.reduce((a, o) => a + o.minutes, 0)),
  );

  return (
    <OffprintMotion total={offprints.length}>
      <section id="top" data-count="00" className="op-grid op-hero">
        <div className="op-hero-body">
          <h1 className="op-open">
            <Line delay={0}>One paper,</Line>
            <Line delay={90}>
              printed <em>alone</em>.
            </Line>
          </h1>
          <div className="op-meta op-label">
            <span data-reveal="fade" data-delay="260">
              {date}
            </span>
            {offprints.length > 0 && (
              <>
                <span data-reveal="fade" data-delay="320">
                  {countWord(offprints.length)} offprint
                  {offprints.length === 1 ? "" : "s"}
                </span>
                <span data-reveal="fade" data-delay="380">
                  {minutes} min
                </span>
              </>
            )}
          </div>
          {error && (
            <p className="op-error" role="status">
              The paper index could not be reached ({error}). This page
              tries again every five minutes.
            </p>
          )}
        </div>
        <div className="op-cue op-label" aria-hidden="true">
          scroll
        </div>
      </section>

      {offprints.map((o, i) => (
        <OffprintSection key={o.arxivId} offprint={o} index={i} />
      ))}

      {issue && (
        <section id="archive" data-stack="" className="op-grid op-archive">
          <div className="op-archive-head">
            <Link
              href="/archive"
              className="op-label"
              data-reveal="fade"
              data-delay="0"
            >
              The archive · {issue.archiveTotal.toLocaleString("en-US")}
            </Link>
          </div>
          <ul className="op-archive-list">
            {issue.archive.map((row, i) => (
              <li key={row.href}>
                <Link
                  href={row.href}
                  className="op-row"
                  data-cur="open"
                  data-reveal="fade"
                  data-delay={80 + i * 60}
                >
                  <span>{row.label}</span>
                  <span className="op-row-count">
                    {row.count.toLocaleString("en-US")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="about" data-count="end" data-stack="" className="op-grid op-about">
        <div className="op-about-body">
          <p className="op-lede">
            <Line delay={0}>Six papers a day,</Line>
            <Line delay={90}>read all the way</Line>
            <Line delay={180}>through.</Line>
          </p>
          <div
            className="op-colophon op-label"
            data-reveal="fade"
            data-delay="320"
          >
            Decoded · issue {issueNumber(now)} · {date}
          </div>
        </div>
      </section>
    </OffprintMotion>
  );
}
