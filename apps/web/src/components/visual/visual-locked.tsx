"use client";

import { PageSection, WhereItBreaks } from "@/components/page-shell";
import { predictFromResults, type VisualDecode } from "@/lib/visual-types";

import { Glyph } from "./glyphs";
import { ResultsBlock } from "./results-block";
import { SimLab } from "./sims";
import { TermChips } from "./term-chips";

/*
  A parte do decode visual que é de quem tem conta: o palpite e os
  resultados, o laboratório, os termos e os limites. Só é montada no
  cliente, depois que o Clerk confirma a sessão.
*/
export function VisualLocked({ v }: { v: VisualDecode }) {
  return (
    <>
      {(v.results || v.predict) && (
        <PageSection id="results" label="What they found">
          <ResultsBlock results={v.results} predict={v.predict ?? predictFromResults(v.results)} />
        </PageSection>
      )}

      {v.sim.template !== "none" && (
        <PageSection id="lab" label={v.sim.title} aside="try it">
          <SimLab sim={v.sim} />
        </PageSection>
      )}

      {(v.terms.length > 0 || v.analogy) && (
        <PageSection id="terms" label="Terms" aside={v.terms.length ? `${v.terms.length} terms` : undefined}>
          {v.terms.length > 0 && <TermChips terms={v.terms} />}
          {v.analogy && (
            <div className="vz-analogy" data-reveal="fade" data-delay="120">
              <p className="op-prose m-0">{v.analogy.text}</p>
              <WhereItBreaks className="mt-[calc(24*var(--px))]">{v.analogy.breaks}</WhereItBreaks>
            </div>
          )}
        </PageSection>
      )}

      {v.limits.length > 0 && (
        <PageSection id="limits" label="Limits">
          <ul className="vz-limits" data-reveal="fade" data-delay="60">
            {v.limits.map((l) => (
              <li key={l}>
                <Glyph name="warning" size={18} className="vz-limit-glyph" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {v.deep.length > 0 && (
        <PageSection id="long" label="Long version" aside={`${v.deep.length} parts`}>
          <details className="vz-deep" data-reveal="fade" data-delay="60">
            <summary className="op-link">Read the long version</summary>
            <div className="vz-deep-body">
              {v.deep.map((part) => (
                <div key={part.heading} className="vz-deep-part">
                  <h3 className="op-h3">{part.heading}</h3>
                  <p className="op-prose op-prose-2 m-0">{part.body}</p>
                </div>
              ))}
            </div>
          </details>
        </PageSection>
      )}
    </>
  );
}
