import type { Metadata } from "next";
import Link from "next/link";
import { Ledger, LedgerNum, LedgerRow } from "@/components/ledger";
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
import { Icon } from "@/components/icons";

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
        title="Institutions"
        lead="Labs and universities behind the papers in the corpus, ranked by output."
        meta={
          <>
            <Link href="/authors" className="op-link">
              Authors <Icon name="arrow-right" />
            </Link>
          </>
        }
      />

      <Column>
        {error && <ErrorNote title="Institutions unavailable" message={error} />}
        <Ledger columns={["Papers", "Institution"]}>
          {(data?.institutions ?? []).map((i) => (
            <LedgerRow
              key={i.slug}
              href={`/institution/${i.slug}`}
              num={<LedgerNum value={i.paper_count} unit="papers" />}
              title={i.name}
              meta={
                <>
                  {i.country_code && <span>{i.country_code}</span>}
                  <span className="tnum">{i.author_count} authors</span>
                </>
              }
            />
          ))}
        </Ledger>
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
