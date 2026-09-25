"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { categoryLabel } from "@/lib/format";

const CATEGORIES = ["cs.AI", "cs.CL", "cs.LG", "cs.CV"] as const;

/** Filtros do arquivo: a tipografia da navegação, sublinhado no ativo. */
export function CategoryFilter() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("category");
  const decodedOnly = params.get("decoded") === "1";

  function buildHref(patch: Record<string, string | null>): string {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <nav className="op-tabs" aria-label="Filter papers">
      <Link
        href={buildHref({ category: null })}
        className="op-nav-link"
        aria-current={active === null ? "page" : undefined}
      >
        All
      </Link>

      {CATEGORIES.map((c) => (
        <Link
          key={c}
          href={buildHref({ category: c })}
          title={categoryLabel(c)}
          className="op-nav-link"
          aria-current={active === c ? "page" : undefined}
        >
          {c.replace("cs.", "")}
        </Link>
      ))}

      <Link
        href={buildHref({ decoded: decodedOnly ? null : "1" })}
        className="op-nav-link op-tabs-aside"
        data-on={decodedOnly ? "" : undefined}
      >
        Decoded only
      </Link>
    </nav>
  );
}
