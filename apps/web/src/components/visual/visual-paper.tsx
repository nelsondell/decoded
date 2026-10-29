import { PageSection, WhereItBreaks } from "@/components/page-shell";
import { predictFromResults, type Stat, type Step, type VisualDecode } from "@/lib/visual-types";

import { FlowDiagram } from "./flow-diagram";
import { Glyph } from "./glyphs";
import { ResultsBlock } from "./results-block";
import { SimLab } from "./sims";
import { TermChips } from "./term-chips";

/*
  A página do paper no decode visual. Pouca prosa, na ordem em que se
  entende: a frase e o número; os três passos; o método desenhado; o
  palpite e os resultados; o laboratório. O resto (termos, analogia,
  limites, versão longa) fica embaixo e curto.
*/

export type VisualNavItem = { id: string; label: string };

export function visualNav(v: VisualDecode): VisualNavItem[] {
  return [
    { id: "tldr", label: "In one line" },
    { id: "how", label: "How it works" },
    ...(v.results || v.predict ? [{ id: "results", label: "Results" }] : []),
    ...(v.sim.template !== "none" ? [{ id: "lab", label: "Try it" }] : []),
    ...(v.terms.length || v.analogy ? [{ id: "terms", label: "Terms" }] : []),
    ...(v.limits.length ? [{ id: "limits", label: "Limits" }] : []),
    ...(v.deep.length ? [{ id: "long", label: "Long version" }] : []),
  ];
}

function parseNum(s: string | null): number | null {
  if (!s) return null;
  const m = s.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function StatBlock({ stat }: { stat: Stat }) {
  const ours = parseNum(stat.value);
  const base = parseNum(stat.baseline_value);
  const bars = ours != null && base != null && ours > 0 && base > 0;
  const max = bars ? Math.max(ours, base) : 1;

  return (
    <div className="vz-stat" data-reveal="fade" data-delay="120">
      <p className="vz-stat-value tnum">
        {stat.value}
        {stat.unit && (
          // % e × colam no número; palavras (F1, pts, tokens) ganham um respiro
          <span className="vz-stat-unit" data-word={/^[%×x]/.test(stat.unit) ? undefined : ""}>
            {stat.unit}
          </span>
        )}
      </p>
      <p className="vz-stat-label">{stat.label}</p>
      {bars && (
        <div className="vz-stat-bars" aria-hidden>
          <div className="vz-stat-bar" data-ours="">
            <span className="vz-stat-fill" style={{ width: `${(ours / max) * 100}%` }} />
            <span className="vz-stat-tag">this paper</span>
          </div>
          <div className="vz-stat-bar">
            <span className="vz-stat-fill" style={{ width: `${(base / max) * 100}%` }} />
            <span className="vz-stat-tag tnum">
              {stat.baseline_label ?? "baseline"} · {stat.baseline_value}
            </span>
          </div>
        </div>
      )}
      <p className="vz-stat-context">{stat.context}</p>
    </div>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="vz-steps">
      {steps.map((s, i) => (
        <li key={s.kind} className="vz-step" data-reveal="fade" data-delay={String(80 + i * 140)}>
          <Glyph name={s.glyph} className="vz-step-glyph" />
          <h3 className="vz-step-title">{s.title}</h3>
          <p className="vz-step-text">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function VisualPaper({ v }: { v: VisualDecode }) {
  return (
    <>
      <section id="tldr" className="op-section vz-lead">
        <p className="op-big vz-hook" data-reveal="fade" data-delay="60">
          {v.hook}
        </p>
        {v.stat && <StatBlock stat={v.stat} />}
      </section>

      <PageSection id="how" label="How it works">
        <Steps steps={v.steps} />
        {v.flow && <FlowDiagram flow={v.flow} />}
      </PageSection>

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
