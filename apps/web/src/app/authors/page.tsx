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
import { api, type PeopleListResponse } from "@/lib/api";
import { rethrowDuringRevalidation } from "@/lib/isr";
import { Icon } from "@/components/icons";

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
        title="Authors"
        lead="Researchers with more than one paper in the corpus, ranked by output."
        meta={
          <>
            <Link href="/institutions" className="op-link">
              Institutions <Icon name="arrow-right" />
            </Link>
          </>
        }
      />

      <Column>
        {error && <ErrorNote title="Authors unavailable" message={error} />}
        <Ledger columns={["Papers", "Author"]}>
          {(data?.authors ?? []).map((a) => (
            <LedgerRow
              key={a.slug}
              href={`/author/${a.slug}`}
              num={<LedgerNum value={a.paper_count} unit="papers" />}
              title={a.name}
              hook={a.affiliation}
              meta={!a.is_disambiguated ? <span>name match</span> : undefined}
            />
          ))}
        </Ledger>
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
