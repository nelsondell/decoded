import type { Metadata } from "next";
import Link from "next/link";
import {
  Column,
  ErrorNote,
  Masthead,
  PageShell,
  Rail,
  RailHeading,
  RailNote,
} from "@/components/page-shell";
import { api, type PeopleListResponse } from "@/lib/api";
import { rethrowDuringRevalidation } from "@/lib/isr";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Authors",
  description: "Researchers publishing across the papers Decoded tracks.",
};

export default async function AuthorsPage() {
  let data: PeopleListResponse | null = null;
  let error: string | null = null;
  try {
    data = await api.getAuthors(100);
  } catch (e) {
    rethrowDuringRevalidation(e);
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <PageShell>
      <Masthead
        kicker={
          <>
            <span>People</span>
            <Link href="/institutions" className="op-link">
              Institutions →
            </Link>
          </>
        }
        title="Authors"
        lead="Researchers with more than one paper in the corpus, ranked by output."
      />

      <Column>
        {error && <ErrorNote title="Authors unavailable" message={error} />}
        <ul className="op-archive-list">
          {(data?.authors ?? []).map((a) => (
            <li key={a.slug} data-reveal="fade" data-delay="auto">
              <Link href={`/author/${a.slug}`} className="op-row" data-size="s" data-cur="open">
                <span className="op-row-main">
                  <span>{a.name}</span>
                  {(a.affiliation || !a.is_disambiguated) && (
                    <span className="op-row-sub">
                      {a.affiliation}
                      {!a.is_disambiguated && (
                        <span className="ml-3 uppercase tracking-[0.14em]">name match</span>
                      )}
                    </span>
                  )}
                </span>
                <span className="op-row-count">{a.paper_count} papers</span>
              </Link>
            </li>
          ))}
        </ul>
      </Column>

      <Rail>
        <RailHeading>Where it breaks</RailHeading>
        <RailNote>
          Authors are grouped by name unless the corpus gives us something better
          to go on. Two researchers who share a name may share a page — those
          rows are marked &ldquo;name match&rdquo;.
        </RailNote>
      </Rail>
    </PageShell>
  );
}
