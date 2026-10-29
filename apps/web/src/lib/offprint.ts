/**
 * Datas, tempo de leitura e a prancha da página do paper.
 *
 * Tudo aqui é puro e roda no servidor. As pranchas não inventam dados —
 * cada gráfico sai do que a API já devolve: os resultados do próprio paper,
 * o tamanho de cada camada do decode, onde o deep dive gasta as palavras.
 */

import type { PaperDetail } from "@/lib/api";
import {
  DEEP_DIVE_ORDER,
  decoded as sections,
  type DecodedMap,
} from "@/lib/decoded-types";
import { visualOf, visualWords } from "@/lib/visual-types";

/** Palavras por minuto de leitura atenta. */
const WPM = 230;

// ---------------------------------------------------------------- texto

const NUMBER_WORDS = [
  "no", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function words(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/**
 * "18 sep 2026" — a data da edição, em UTC para não variar entre regiões.
 * Montada à mão: o ICU recente escreve "Sept" em en-GB.
 */
export function issueDate(now: Date): string {
  return `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

// ------------------------------------------------------- tempo de leitura

function decodedWords(map: DecodedMap): {
  sixty: number;
  deep: number;
  bySection: number[];
  total: number;
} {
  const one = sections.oneSentence(map);
  const sixty = sections.sixtySecond(map);
  const deep = sections.deepDive(map);
  const figures = sections.figures(map);
  const analogies = sections.analogies(map);
  const vocabulary = sections.vocabulary(map);

  const sixtyWords = sixty
    ? words(sixty.problem) + words(sixty.approach) + words(sixty.result)
    : 0;
  const bySection = deep
    ? DEEP_DIVE_ORDER.map((k) => words(deep[k]?.heading) + words(deep[k]?.body))
    : [];
  const deepWords = bySection.reduce((a, b) => a + b, 0);

  const visual = visualOf(map);
  const rest =
    (visual ? visualWords(visual) : words(one?.text)) +
    (figures?.items ?? []).reduce(
      (a, f) => a + words(f.plain_language) + words(f.key_insight),
      0,
    ) +
    (analogies?.items ?? []).reduce((a, x) => a + words(x.analogy), 0) +
    (vocabulary?.terms ?? []).reduce((a, t) => a + words(t.definition), 0);

  return {
    sixty: sixtyWords,
    deep: deepWords,
    bySection,
    total: sixtyWords + deepWords + rest,
  };
}

function formatDuration(minutes: number, long = false): string {
  if (minutes < 1) {
    const s = Math.max(5, Math.round((minutes * 60) / 5) * 5);
    return long ? `${s} seconds` : `${s} S`;
  }
  const m = Math.round(minutes * 10) / 10;
  const shown = Number.isInteger(m) ? String(m) : m.toFixed(1);
  if (!long) return `${shown} MIN`;
  const whole = Math.round(minutes);
  return `${countWord(whole)} minute${whole === 1 ? "" : "s"}`;
}

// ------------------------------------------------------------- pranchas

export type ColumnsFigure = {
  type: "columns";
  bars: { value: number; highlight: boolean }[];
  max: number;
  yLabel: string;
  axis: [string, string];
  mark: string;
  caption: [string, string];
  label: string;
};

export type RowsFigure = {
  type: "rows";
  rows: { label: string; value: number; display: string; highlight: boolean }[];
  max: number;
  axis: [string, string];
  caption: [string, string];
  label: string;
};

export type CurveFigure = {
  type: "curve";
  /** Valores entre 0 e 1, espaçados igualmente no eixo x. */
  primary: number[];
  secondary?: number[];
  secondaryLabel?: string;
  marker?: { at: number; label: string };
  threshold?: { value: number; label: string };
  axis: [string, string];
  caption: [string, string];
  label: string;
};

export type FigureSpec = ColumnsFigure | RowsFigure | CurveFigure;

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (v <= step * base) return step * base;
  }
  return 10 * base;
}

function cumulativeShare(values: number[]): number[] {
  const total = values.reduce((x, y) => x + y, 0) || 1;
  let run = 0;
  return values.map((v) => (run += v) / total);
}

function layerRows(map: DecodedMap): RowsFigure | null {
  const w = decodedWords(map);
  if (!w.sixty || !w.deep) return null;

  const sixty = w.sixty / WPM;
  const deep = w.deep / WPM;
  const max = Math.max(1, Math.ceil(deep * 1.18));

  return {
    type: "rows",
    rows: [
      { label: "THE SIXTY-SECOND READ", value: sixty, display: formatDuration(sixty), highlight: true },
      { label: "THE DEEP DIVE", value: deep, display: formatDuration(deep), highlight: false },
    ],
    max,
    axis: ["0", `${max} MIN READ`],
    caption: [
      "fig. reading time by layer",
      `${formatDuration(sixty, true)} against ${formatDuration(deep, true)}`,
    ],
    label: `Reading time: sixty-second read ${formatDuration(sixty, true)}, deep dive ${formatDuration(deep, true)}`,
  };
}

/**
 * Os resultados do próprio paper: o método dele contra os três melhores
 * rivais. Benchmark ou levantamento não tem método próprio; aí o líder
 * vai em destaque.
 */
function resultsRows(map: DecodedMap): RowsFigure | null {
  const results = visualOf(map)?.results;
  if (!results || results.rows.some((r) => r.value < 0)) return null;

  const better = (a: number, b: number) => (results.higher_is_better ? b - a : a - b);
  const ranked = [...results.rows].sort((a, b) => better(a.value, b.value));
  const lead = results.rows.find((r) => r.ours) ?? ranked[0];
  const picked = [lead, ...ranked.filter((r) => r !== lead).slice(0, 3)].sort((a, b) => better(a.value, b.value));
  if (picked.length < 2) return null;

  const max = niceCeil(Math.max(...picked.map((r) => r.value)));
  const suffix = results.unit === "%" ? "%" : "";
  const show = (v: number) => `${Math.round(v * 100) / 100}${suffix}`;

  return {
    type: "rows",
    rows: picked.map((r) => ({
      label: r.label.toUpperCase(),
      value: r.value,
      display: show(r.value),
      highlight: r === lead,
    })),
    max,
    axis: ["0", `${max}${suffix} ${results.metric}`.toUpperCase()],
    caption: [`fig. ${results.metric.toLowerCase()}`, results.caption],
    label: `${results.caption}: ${picked.map((r) => `${r.label} ${show(r.value)}`).join(", ")}`,
  };
}

function argumentCurve(map: DecodedMap): CurveFigure | null {
  const { bySection } = decodedWords(map);
  const top = Math.max(...bySection, 0);
  if (bySection.length < 3 || top <= 0) return null;

  const at = bySection.indexOf(top);
  const name = DEEP_DIVE_ORDER[at];
  const total = bySection.reduce((a, b) => a + b, 0);
  const pct = Math.round((top / total) * 100);

  return {
    type: "curve",
    primary: bySection.map((v) => v / top),
    secondary: cumulativeShare(bySection),
    secondaryLabel: "CUMULATIVE",
    marker: { at, label: `${name.toUpperCase()} · ${pct}%` },
    axis: [DEEP_DIVE_ORDER[0].toUpperCase(), DEEP_DIVE_ORDER[DEEP_DIVE_ORDER.length - 1].toUpperCase()],
    caption: ["fig. where the deep dive spends its words", `the ${name} carries the argument`],
    label: `Words per deep-dive section; the ${name} is longest at ${pct} percent`,
  };
}

// ------------------------------------------------------- página do paper

/** A prancha da página do paper: onde o deep dive gasta as palavras. */
export function paperFigure(detail: PaperDetail): FigureSpec | null {
  const map = (detail.decoded ?? {}) as DecodedMap;
  if (Object.keys(map).length === 0) return null;
  return resultsRows(map) ?? argumentCurve(map) ?? layerRows(map);
}

/** Minutos de leitura: todas as camadas do decode, ou o abstract. */
export function readingMinutes(detail: PaperDetail): number {
  const map = (detail.decoded ?? {}) as DecodedMap;
  const total =
    Object.keys(map).length > 0 ? decodedWords(map).total : words(detail.abstract);
  return Math.max(1, Math.round(total / WPM));
}

