import { PageSection } from "@/components/page-shell";
import type { Stat, Step, VisualDecode, Walkthrough as WalkthroughData } from "@/lib/visual-types";

import { FlowDiagram } from "./flow-diagram";
import { Glyph } from "./glyphs";
import type { MemberTeaser } from "./members-gate";
import { Walkthrough } from "./walkthrough";

/*
  A página do paper no decode visual. Pouca prosa, na ordem em que se
  entende: a frase e o número; os três passos; o método desenhado. Essa
  parte é aberta e sai no HTML. Resultados, laboratório, termos e limites
  são de quem tem conta e chegam pelo cliente (visual-locked.tsx).
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
  const glued = stat.unit.match(/^([%×x])(?:\s+(.*))?$/);
  const sign = glued?.[1] ?? "";
  const rest = glued ? (glued[2] ?? "") : stat.unit;

  return (
    <div className="vz-stat" data-reveal="fade" data-delay="120">
      <p className="vz-stat-value tnum">
        {stat.value}
        {sign && <span className="vz-stat-unit">{sign}</span>}
      </p>
      {/* A mesma gramática do livro de achados: palavras descem para baixo do número */}
      {rest && <p className="vz-stat-unit-line">{rest}</p>}
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

/**
 * A parte aberta: a frase, o número e como funciona. Com passo a passo,
 * o "como funciona" é o diagrama interativo; sem, os três passos e o fluxo.
 */
export function VisualOpen({ v, walkthrough }: { v: VisualDecode; walkthrough?: WalkthroughData }) {
  return (
    <>
      <section id="tldr" className="op-section vz-lead">
        <p className="op-big vz-hook" data-reveal="fade" data-delay="60">
          {v.hook}
        </p>
        {v.stat && <StatBlock stat={v.stat} />}
      </section>

      {walkthrough ? (
        <PageSection id="how" label="How it works" aside={`${walkthrough.stages.length} steps`}>
          <Walkthrough data={walkthrough} />
        </PageSection>
      ) : (
        <PageSection id="how" label="How it works">
          <Steps steps={v.steps} />
          {v.flow && <FlowDiagram flow={v.flow} />}
        </PageSection>
      )}
    </>
  );
}

/**
 * O que a trava anuncia sem entregar: nomes e contagens, nunca valores.
 * É só isso que vai para o HTML de quem não entrou.
 */
export function memberTeaser(v: VisualDecode): MemberTeaser {
  return {
    metric: v.results?.metric ?? null,
    simTitle: v.sim.template !== "none" ? v.sim.title : null,
    terms: v.terms.length,
    limits: v.limits.length,
  };
}
