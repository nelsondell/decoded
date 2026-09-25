/**
 * A capa como edição: seis offprints, cada um com uma prancha.
 *
 * Tudo aqui é puro e roda no servidor. As pranchas não inventam dados —
 * cada gráfico sai do que a API já devolve: o sinal da comunidade de cada
 * paper na fila, o tamanho de cada camada do decode, onde o deep dive gasta
 * as palavras. Um paper ainda não decodificado cai nos gráficos de sinal.
 */

import type { PaperCard, PaperDetail } from "@/lib/api";
import {
  DEEP_DIVE_ORDER,
  decoded as sections,
  type DecodedMap,
} from "@/lib/decoded-types";

export const OFFPRINTS_PER_ISSUE = 6;

/** Palavras por minuto de leitura atenta. */
const WPM = 230;

/** Primeiro dia no ar; a edição N é o N-ésimo dia desde então. */
const ISSUE_EPOCH_UTC = Date.UTC(2026, 7, 1);

// ---------------------------------------------------------------- texto

const NUMBER_WORDS = [
  "no", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

const ORDINALS = [
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
  "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth",
  "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
  "nineteenth", "twentieth",
];

export function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

export function words(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
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

export function issueNumber(now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - ISSUE_EPOCH_UTC) / 86_400_000) + 1);
}

/**
 * Títulos do arXiv são mais longos que os do protótipo; o tipo desce um
 * degrau para os longos. A quebra em linhas fica com o navegador.
 */
export function titleSize(title: string): "l" | "m" | "s" {
  const n = title.replace(/\s+/g, " ").trim().length;
  return n <= 60 ? "l" : n <= 100 ? "m" : "s";
}

/** Primeira frase do abstract, cortada se passar de ~40 palavras. */
function abstractLead(abstract: string): string {
  const clean = abstract.replace(/\s+/g, " ").trim();
  const first = clean.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] ?? clean;
  const tokens = first.split(" ");
  return tokens.length > 40 ? `${tokens.slice(0, 36).join(" ")}…` : first;
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

  const rest =
    words(one?.text) +
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

/** A ordem das pranchas repete o ritmo do protótipo. */
const RHYTHM = ["columns", "rows", "curve", "columns", "threshold", "rows"] as const;
type Kind = (typeof RHYTHM)[number];

type Metric = {
  label: string;
  unit: string;
  of: (p: PaperCard) => number;
  format: (v: number) => string;
};

/**
 * Menções no HN quando existem — variam de paper para paper. Se a fila
 * inteira está em zero, cai para o score de prioridade.
 */
function pickMetric(pool: PaperCard[]): Metric {
  if (pool.some((p) => p.hn_mentions > 0)) {
    return {
      label: "hacker news mentions",
      unit: "MENTIONS",
      of: (p) => p.hn_mentions,
      format: (v) => String(Math.round(v)),
    };
  }
  return {
    label: "community signal",
    unit: "SCORE",
    of: (p) => p.priority_score,
    format: (v) => v.toFixed(1),
  };
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (v <= step * base) return step * base;
  }
  return 10 * base;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function cumulativeShare(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let run = 0;
  return values.map((v) => (run += v) / total);
}

function signalColumns(pool: PaperCard[], paper: PaperCard, metric: Metric): ColumnsFigure {
  const values = pool.map(metric.of);
  const mine = metric.of(paper);
  const rank = 1 + values.filter((v) => v > mine).length;
  const n = pool.length;

  return {
    type: "columns",
    bars: pool.map((p) => ({ value: metric.of(p), highlight: p.arxiv_id === paper.arxiv_id })),
    max: Math.max(...values, 0) || 1,
    yLabel: metric.format(Math.max(...values, 0)),
    axis: ["#1", `#${n}`],
    mark: `THIS PAPER · ${metric.format(mine)}`,
    caption: [
      `fig. ${metric.label} across ${countWord(n)} papers`,
      `this one ranks ${ordinal(rank)}`,
    ],
    label: `${metric.label} for ${n} papers in queue order; this paper ranks ${ordinal(rank)}`,
  };
}

function signalRows(pool: PaperCard[], paper: PaperCard, metric: Metric): RowsFigure | null {
  const mine = metric.of(paper);
  const mid = median(pool.map(metric.of));
  const top = Math.max(mine, mid);
  if (top <= 0) return null;

  const relation =
    mid === 0 || mine > mid * 1.05
      ? mid === 0
        ? "the median is zero"
        : `${(mine / mid).toFixed(1)}× the median`
      : mine < mid * 0.95
        ? "below the median"
        : "right on the median";

  return {
    type: "rows",
    rows: [
      { label: "THIS PAPER", value: mine, display: metric.format(mine), highlight: true },
      {
        label: `MEDIAN OF THE ${countWord(pool.length).toUpperCase()}`,
        value: mid,
        display: metric.format(mid),
        highlight: false,
      },
    ],
    max: niceCeil(top * 1.18),
    axis: ["0", `${metric.format(niceCeil(top * 1.18))} ${metric.unit}`],
    caption: [`fig. ${metric.label} against the median`, relation],
    label: `${metric.label}: this paper ${metric.format(mine)}, median ${metric.format(mid)}`,
  };
}

function signalCurve(pool: PaperCard[], paper: PaperCard, metric: Metric): CurveFigure | null {
  const sorted = [...pool].sort((a, b) => metric.of(b) - metric.of(a));
  const values = sorted.map(metric.of);
  const top = values[0] ?? 0;
  if (top <= 0 || values.length < 3) return null;

  const at = sorted.findIndex((p) => p.arxiv_id === paper.arxiv_id);
  if (at < 0) return null;
  return {
    type: "curve",
    primary: values.map((v) => v / top),
    secondary: cumulativeShare(values),
    secondaryLabel: "CUMULATIVE SHARE",
    marker: { at, label: `THIS PAPER · #${at + 1}` },
    axis: ["MOST", "LEAST"],
    caption: [`fig. ${metric.label}, sorted`, `this one sits ${ordinal(at + 1)}`],
    label: `${metric.label} sorted from most to least across ${values.length} papers; this paper is ${ordinal(at + 1)}`,
  };
}

function signalThreshold(pool: PaperCard[], metric: Metric): CurveFigure | null {
  const values = pool.map(metric.of).sort((a, b) => b - a);
  if (values.length < 3 || values[0] <= 0) return null;

  const share = [0, ...cumulativeShare(values)];
  const half = share.findIndex((v) => v >= 0.5);
  return {
    type: "curve",
    primary: share,
    threshold: { value: 0.5, label: `HALF OF ALL ${metric.unit}` },
    axis: ["0", `${values.length} PAPERS`],
    caption: [
      `fig. how ${metric.label} concentrate`,
      `half of it goes to ${countWord(half)} paper${half === 1 ? "" : "s"}`,
    ],
    label: `Cumulative share of ${metric.label}; half goes to ${half} papers`,
  };
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

function argumentThreshold(map: DecodedMap): CurveFigure | null {
  const { bySection } = decodedWords(map);
  if (bySection.length < 3 || bySection.every((v) => v === 0)) return null;

  const share = [0, ...cumulativeShare(bySection)];
  const half = share.findIndex((v) => v >= 0.5);
  const name = DEEP_DIVE_ORDER[Math.max(0, half - 1)];

  return {
    type: "curve",
    primary: share,
    threshold: { value: 0.5, label: "HALF THE DEEP DIVE" },
    axis: [DEEP_DIVE_ORDER[0].toUpperCase(), DEEP_DIVE_ORDER[DEEP_DIVE_ORDER.length - 1].toUpperCase()],
    caption: [
      "fig. cumulative words across the deep dive",
      `half the argument is made by the ${name}`,
    ],
    label: `Cumulative words across the deep dive; half is reached in the ${name}`,
  };
}

function figureFor(
  kind: Kind,
  paper: PaperCard,
  detail: PaperDetail | null,
  pool: PaperCard[],
  metric: Metric,
): FigureSpec {
  const map = (detail?.decoded ?? {}) as DecodedMap;
  const isDecoded = Object.keys(map).length > 0;

  const candidate =
    kind === "rows"
      ? (isDecoded ? layerRows(map) : null) ?? signalRows(pool, paper, metric)
      : kind === "curve"
        ? (isDecoded ? argumentCurve(map) : null) ?? signalCurve(pool, paper, metric)
        : kind === "threshold"
          ? (isDecoded ? argumentThreshold(map) : null) ?? signalThreshold(pool, metric)
          : null;

  return candidate ?? signalColumns(pool, paper, metric);
}

// ------------------------------------------------------- página do paper

/** A prancha da página do paper: onde o deep dive gasta as palavras. */
export function paperFigure(detail: PaperDetail): FigureSpec | null {
  const map = (detail.decoded ?? {}) as DecodedMap;
  if (Object.keys(map).length === 0) return null;
  return argumentCurve(map) ?? layerRows(map);
}

/** Minutos de leitura: todas as camadas do decode, ou o abstract. */
export function readingMinutes(detail: PaperDetail): number {
  const map = (detail.decoded ?? {}) as DecodedMap;
  const total =
    Object.keys(map).length > 0 ? decodedWords(map).total : words(detail.abstract);
  return Math.max(1, Math.round(total / WPM));
}

// ---------------------------------------------------------------- edição

export type Offprint = {
  arxivId: string;
  title: string;
  kicker: string;
  dek: string;
  decoded: boolean;
  minutes: number;
  figure: FigureSpec;
};

/**
 * Monta os offprints. A fila começa pelos decodificados; se não houver seis,
 * completa com os de maior prioridade ainda na fila, que entram com o
 * abstract no lugar da frase-resumo.
 */
export function buildOffprints(
  decodedFeed: PaperCard[],
  fullFeed: PaperCard[],
  details: Map<string, PaperDetail>,
): Offprint[] {
  const seen = new Set<string>();
  const pool: PaperCard[] = [];
  for (const p of [...decodedFeed, ...fullFeed]) {
    if (seen.has(p.arxiv_id)) continue;
    seen.add(p.arxiv_id);
    pool.push(p);
  }

  const picks = pool.slice(0, OFFPRINTS_PER_ISSUE);
  const chartPool = pool.slice(0, 20);
  const metric = pickMetric(chartPool);

  return picks.map((paper, i) => {
    const detail = details.get(paper.arxiv_id) ?? null;
    const map = (detail?.decoded ?? {}) as DecodedMap;
    const isDecoded = paper.is_decoded && Object.keys(map).length > 0;

    const oneSentence = paper.one_sentence ?? sections.oneSentence(map)?.text;
    const dek = oneSentence ?? (detail ? abstractLead(detail.abstract) : "");

    const readWords = isDecoded ? decodedWords(map).total : words(detail?.abstract);
    const category = paper.categories?.[0];

    return {
      arxivId: paper.arxiv_id,
      title: paper.title,
      kicker: [`arXiv:${paper.arxiv_id}`, category, isDecoded ? null : "undecoded"]
        .filter(Boolean)
        .join(" · "),
      dek,
      decoded: isDecoded,
      minutes: readWords / WPM,
      figure: figureFor(RHYTHM[i % RHYTHM.length], paper, detail, chartPool, metric),
    };
  });
}
