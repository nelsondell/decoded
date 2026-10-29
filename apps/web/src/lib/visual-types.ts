/**
 * O decode visual — espelha decoded/visual/schemas.py (schema "visual/1").
 *
 * Uma seção só, "visual", com tudo que a página desenha. Papers antigos
 * continuam com as seis seções em prosa; a página escolhe pelo que existe.
 */

import type { DecodedMap } from "@/lib/decoded-types";

export type Glyph =
  | "question" | "data" | "model" | "gear" | "chart" | "check" | "warning"
  | "search" | "text" | "image" | "robot" | "scale" | "clock" | "compare"
  /* Só da interface (a trava do paper); o decode não escolhe este */
  | "slider";

export type SimTemplate =
  | "sampling_temperature"
  | "gradient_descent"
  | "threshold_tradeoff"
  | "scaling_law"
  | "topk_retrieval"
  | "quantization"
  | "majority_vote"
  | "tradeoff_curve"
  | "none";

export type CurveShape = "rise_then_fall" | "saturating" | "decaying" | "power_law" | "s_curve";

export interface Stat {
  value: string;
  unit: string;
  label: string;
  context: string;
  baseline_value: string | null;
  baseline_label: string | null;
  higher_is_better: boolean;
  source_quote: string;
}

export interface Step {
  kind: "problem" | "approach" | "result";
  title: string;
  text: string;
  glyph: Glyph;
}

export interface FlowNode {
  id: string;
  label: string;
  kind: "input" | "data" | "model" | "process" | "output";
}

export interface FlowEdge {
  source: string;
  target: string;
  label: string | null;
}

export interface Flow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ResultRow {
  label: string;
  value: number;
  ours: boolean;
}

export interface Results {
  metric: string;
  unit: string;
  higher_is_better: boolean;
  caption: string;
  rows: ResultRow[];
  source_quote: string;
}

export interface Predict {
  question: string;
  options: string[];
  answer: number;
  reveal: string;
}

export interface Sim {
  template: SimTemplate;
  title: string;
  question: string;
  takeaway: string;
  x_label: string;
  x_unit: string;
  x_min: number;
  x_max: number;
  x_default: number;
  y_label: string;
  y_unit: string;
  shape: CurveShape | null;
  labels: string[];
  values: number[];
  paper_x: number | null;
  paper_note: string | null;
}

export interface Term {
  term: string;
  plain: string;
}

export interface VisualDecode {
  schema: string;
  hook: string;
  stat: Stat | null;
  steps: Step[];
  flow: Flow | null;
  results: Results | null;
  predict: Predict | null;
  sim: Sim;
  terms: Term[];
  analogy: { text: string; breaks: string } | null;
  limits: string[];
  deep: { heading: string; body: string }[];
}

/** O passo a passo do método — espelha decoded/visual/walkthrough.py ("walkthrough/1"). */
export interface WalkthroughStage {
  title: string;
  says: string;
  nodes: string[];
  example: string;
  example_format: "text" | "code" | "numbers";
}

export interface Walkthrough {
  example_title: string;
  example_source: string;
  illustrative: boolean;
  input: string;
  output: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  stages: WalkthroughStage[];
}

export function walkthroughOf(map: DecodedMap): Walkthrough | undefined {
  const w = map.walkthrough as Walkthrough | undefined;
  return w && Array.isArray(w.stages) && w.stages.length > 0 && Array.isArray(w.nodes) ? w : undefined;
}

export function visualOf(map: DecodedMap): VisualDecode | undefined {
  const v = map.visual as VisualDecode | undefined;
  return v && typeof v.hook === "string" && Array.isArray(v.steps) ? v : undefined;
}

/** Palavras do decode visual, para o tempo de leitura. */
export function visualWords(v: VisualDecode): number {
  const w = (s: string | null | undefined) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
  return (
    w(v.hook) +
    (v.stat ? w(v.stat.label) + w(v.stat.context) : 0) +
    v.steps.reduce((a, s) => a + w(s.title) + w(s.text), 0) +
    (v.results ? w(v.results.caption) + v.results.rows.length * 3 : 0) +
    w(v.sim.question) + w(v.sim.takeaway) +
    v.terms.reduce((a, t) => a + w(t.plain), 0) +
    (v.analogy ? w(v.analogy.text) + w(v.analogy.breaks) : 0) +
    v.limits.reduce((a, l) => a + w(l), 0)
  );
}

/**
 * O palpite sai da própria tabela de resultados: quem fica no topo da
 * métrica. Sempre bate com os dados, e não custa nada ao decode.
 */
export function predictFromResults(results: Results | null): Predict | null {
  if (!results || results.rows.length < 2) return null;
  const better = (a: ResultRow, b: ResultRow) =>
    results.higher_is_better ? b.value - a.value : a.value - b.value;
  const ranked = [...results.rows].sort(better);
  const best = ranked[0];
  const ours = results.rows.find((r) => r.ours);
  const picks = [best, ...(ours && ours !== best ? [ours] : []), ...ranked.slice(1)]
    .filter((r, i, all) => all.findIndex((x) => x.label === r.label) === i)
    .slice(0, 3);
  // Ordem alfabética: a resposta não fica sempre na primeira posição
  const options = picks.map((r) => r.label).sort((a, b) => a.localeCompare(b));
  const unit = results.unit === "%" ? "%" : results.unit ? ` ${results.unit}` : "";
  const runnerUp = ranked[1];

  return {
    question: `Which comes out on top on ${results.metric}?`,
    options,
    answer: options.indexOf(best.label),
    reveal: `${best.label} leads with ${best.value}${unit}, ahead of ${runnerUp.label} at ${runnerUp.value}${unit}.`,
  };
}
