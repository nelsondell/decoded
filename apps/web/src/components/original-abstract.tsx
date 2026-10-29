"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export function OriginalAbstract({ abstract }: { abstract: string }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="op-section">
      <div className="op-section-head">
        <span className="op-label">From the paper</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="op-link"
        >
          Original abstract <Icon name={open ? "minus" : "plus"} />
        </button>
      </div>

      {open && <p className="op-prose op-prose-2 m-0">{abstract}</p>}
    </section>
  );
}
