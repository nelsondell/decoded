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
import { api, type InstitutionsListResponse } from "@/lib/api";
import { rethrowDuringRevalidation } from "@/lib/isr";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Institutions",
  description: "Labs and universities publishing in the papers Decoded tracks.",
};

export default async function InstitutionsPage() {
  let data: InstitutionsListResponse | null = null;
  let error: string | null = null;
  try {
    data = await api.getInstitutions(100);
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
            <Link href="/authors" className="op-link">
              Authors →
            </Link>
          </>
        }
        title="Institutions"
        lead="Labs and universities behind the papers in the corpus, ranked by output."
      />

      <Column>
        {error && <ErrorNote title="Institutions unavailable" message={error} />}
        <ul className="op-archive-list">
          {(data?.institutions ?? []).map((i) => (
            <li key={i.slug} data-reveal="fade" data-delay="auto">
              <Link href={`/institution/${i.slug}`} className="op-row" data-size="s" data-cur="open">
                <span className="op-row-main">
                  <span>{i.name}</span>
                  {i.country_code && <span className="op-row-sub">{i.country_code}</span>}
                </span>
                <span className="op-row-count">
                  {i.paper_count} papers · {i.author_count} authors
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Column>

      <Rail>
        <RailHeading>Where it breaks</RailHeading>
        <RailNote>
          Affiliations come from what the paper itself declares. A researcher who
          moved between labs shows up under whichever one the paper listed at
          publication time.
        </RailNote>
      </Rail>
    </PageShell>
  );
}
