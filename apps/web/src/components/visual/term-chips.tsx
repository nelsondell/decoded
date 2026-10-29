"use client";

import { useState } from "react";

import type { Term } from "@/lib/visual-types";

/** Termos como fichas: um aberto por vez, o primeiro já aberto. */
export function TermChips({ terms }: { terms: Term[] }) {
  const [open, setOpen] = useState(0);
  const current = terms[open];

  return (
    <div className="vz-terms" data-reveal="fade" data-delay="60">
      <div className="vz-chips" role="tablist" aria-label="Terms">
        {terms.map((t, i) => (
          <button
            key={t.term}
            type="button"
            role="tab"
            aria-selected={i === open}
            className="vz-chip"
            onClick={() => setOpen(i)}
          >
            {t.term}
          </button>
        ))}
      </div>
      {current && (
        <p className="vz-term-def" role="tabpanel" aria-live="polite">
          <span className="vz-term-name">{current.term}</span> {current.plain}
        </p>
      )}
    </div>
  );
}
