import Link from "next/link";
import { PaperCard, PaperList, type LedgerStat } from "@/components/paper-card";
import {
  Column,
  ErrorNote,
  Masthead,
  PageShell,
  Rail,
  RailBlock,
  RailHeading,
  RailNote,
} from "@/components/page-shell";
import { api, type PaperCard as Card } from "@/lib/api";
import { categoryLabel } from "@/lib/format";
import { rethrowDuringRevalidation } from "@/lib/isr";
import { issueDate } from "@/lib/offprint";
import { visualOf } from "@/lib/visual-types";
import { Icon } from "@/components/icons";

export const revalidate = 300; // ISR: a capa se refaz a cada 5 min

const LEDGER_SIZE = 16;
const CATEGORIES = ["cs.CL", "cs.LG", "cs.CV", "cs.AI"] as const;

type Shelf = { href: string; label: string; count: number };

type Home = {
  papers: Card[];
  total: number;
  stats: Map<string, LedgerStat>;
  shelves: Shelf[];
};

/*
  A capa é o livro de achados: os papers decodificados, cada um entrando
  pelo seu número principal. Só dado aberto aqui (a frase e o número);
  os resultados ficam na parte do paper que pede conta.
*/
async function loadHome(): Promise<Home> {
  const [feed, topics] = await Promise.all([
    api.getFeed({ limit: LEDGER_SIZE, decodedOnly: true }),
    api.getTopics({ sort: "size", limit: 8 }).catch(() => null),
  ]);

  // Card sem número (API anterior ao campo stat): o detalhe do paper tem
  const stats = new Map<string, LedgerStat>();
  const missing = feed.papers.filter((p) => !p.stat && p.is_decoded);
  const details = await Promise.allSettled(missing.map((p) => api.getPaper(p.arxiv_id)));
  details.forEach((r) => {
    const stat = r.status === "fulfilled" ? visualOf(r.value.decoded ?? {})?.stat : null;
    if (r.status === "fulfilled" && stat) {
      stats.set(r.value.arxiv_id, { value: stat.value, unit: stat.unit, label: stat.label });
    }
  });

  let shelves: Shelf[] = (topics?.topics ?? []).map((t) => ({
    href: `/topic/${t.slug}`,
    label: t.name,
    count: t.paper_count,
  }));

  // Sem tópicos ainda (clustering não rodou): as categorias do arXiv
  if (shelves.length === 0) {
    const counts = await Promise.allSettled(
      CATEGORIES.map((c) => api.getFeed({ limit: 1, category: c, decodedOnly: true })),
    );
    shelves = CATEGORIES.map((c, i) => {
      const r = counts[i];
      return {
        href: `/archive?decoded=1&category=${c}`,
        label: categoryLabel(c),
        count: r.status === "fulfilled" ? r.value.total : 0,
      };
    }).filter((s) => s.count > 0);
  }

  return { papers: feed.papers, total: feed.total, stats, shelves };
}

export default async function HomePage() {
  let home: Home | null = null;
  let error: string | null = null;
  try {
    home = await loadHome();
  } catch (e) {
    rethrowDuringRevalidation(e);
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <PageShell className="op-home">
      <Masthead
        title="AI papers, decoded from the full text."
        lead="Open one for its headline number, how the method works and what it found."
        meta={
          <>
            <span className="tnum">{issueDate(new Date())}</span>
            {home && <span className="tnum">{home.total.toLocaleString("en-US")} decoded papers</span>}
          </>
        }
      />

      <Column>
        {error && (
          <ErrorNote
            title="The paper index could not be reached"
            message={`${error}. This page tries again every five minutes.`}
          />
        )}

        {home && (
          <>
            <PaperList>
              {home.papers.map((p, i) => (
                <PaperCard
                  key={p.arxiv_id}
                  paper={p}
                  source="home"
                  position={i}
                  stat={home.stats.get(p.arxiv_id)}
                />
              ))}
            </PaperList>

            {home.total > home.papers.length && (
              <Link href="/archive?decoded=1" className="op-link op-home-more">
                All {home.total.toLocaleString("en-US")} decoded papers <Icon name="arrow-right" />
              </Link>
            )}
          </>
        )}
      </Column>

      <Rail>
        {home && home.shelves.length > 0 && (
          <RailBlock>
            <RailHeading>Topics</RailHeading>
            <ul className="op-archive-list op-home-shelves">
              {home.shelves.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="op-row" data-size="xs" data-cur="open">
                    <span className="op-row-main">{s.label}</span>
                    <span className="op-row-count tnum">{s.count.toLocaleString("en-US")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </RailBlock>
        )}
        <RailBlock>
          <RailHeading>How it is made</RailHeading>
          <RailNote>
            Each paper is decoded from its full text, not the abstract. A
            number that cannot be found in the paper is dropped before it
            reaches this page.
          </RailNote>
          <Link href="/archive" className="op-link mt-[calc(20*var(--px))]">
            The full archive <Icon name="arrow-right" />
          </Link>
        </RailBlock>
      </Rail>
    </PageShell>
  );
}
