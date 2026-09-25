"use client";

import Link from "next/link";
import { EVENTS, capture } from "@/lib/analytics";

/** "Read the offprint →" — registra de onde o paper foi aberto. */
export function OffprintLink({
  arxivId,
  position,
  decoded,
  children,
}: {
  arxivId: string;
  position: number;
  decoded: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/paper/${arxivId}`}
      className="op-read"
      data-cur="read"
      data-reveal="fade"
      data-delay="460"
      onClick={() =>
        capture(EVENTS.PAPER_VIEWED, {
          arxiv_id: arxivId,
          source: "offprint",
          position,
          is_decoded: decoded,
        })
      }
    >
      {children}
    </Link>
  );
}
