"use client";

import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { WhereItBreaks } from "@/components/page-shell";
import type { MathMode } from "@/lib/mode-types";

export function MathModeView({ data }: { data: MathMode }) {
  return (
    <div className="flex flex-col gap-[calc(56*var(--px))]">
      <div>
        <p className="op-label m-0">The idea, before notation</p>
        <p className="op-prose mb-0 mt-[calc(14*var(--px))]">{data.intuition}</p>
      </div>

      {data.equations.length === 0 && (
        <p className="op-big text-muted-foreground">
          This paper has no load-bearing equations.
        </p>
      )}

      {data.equations.map((eq, i) => (
        <div key={i} className="border-t border-border pt-[calc(14*var(--px))]">
          <p className="op-label m-0 text-accent">{eq.label}</p>

          <div className="op-inset mt-[calc(18*var(--px))] overflow-x-auto px-[calc(26*var(--px))] py-[calc(28*var(--px))]">
            <ErrorBoundaryMath latex={eq.latex} />
          </div>

          <p className="op-prose mb-0 mt-[calc(20*var(--px))]">
            <span className="op-label mr-2">Read it as</span>
            {eq.plain_reading}
          </p>

          {eq.what_each_symbol_means.length > 0 && (
            <dl className="m-0 mt-[calc(22*var(--px))] border-b border-border">
              {eq.what_each_symbol_means.map((entry, j) => {
                const [symbol, ...rest] = entry.split("—");
                return (
                  <div
                    key={j}
                    className="grid gap-1 border-t border-border py-[calc(10*var(--px))] sm:grid-cols-[calc(120*var(--px))_1fr] sm:gap-[calc(24*var(--px))]"
                  >
                    <dt className="font-mono text-[length:calc(14*var(--px))] font-light text-accent">
                      {symbol.trim()}
                    </dt>
                    <dd className="m-0 text-[length:calc(17*var(--px))] text-muted-foreground">
                      {rest.join("—").trim()}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          <p className="op-prose op-prose-2 mb-0 mt-[calc(20*var(--px))]">{eq.why_it_matters}</p>
        </div>
      ))}

      {data.the_trick && (
        <WhereItBreaks label="The trick">{data.the_trick}</WhereItBreaks>
      )}
    </div>
  );
}

/** KaTeX joga exceção em LaTeX inválido. Cai pro texto bruto. */
function ErrorBoundaryMath({ latex }: { latex: string }) {
  try {
    return <BlockMath math={latex} />;
  } catch {
    return (
      <code className="font-mono text-[length:calc(14*var(--px))] text-muted-foreground">
        {latex}
      </code>
    );
  }
}
