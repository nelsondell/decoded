"use client";

import { useId, useMemo, useState } from "react";

import type { CurveShape, Sim } from "@/lib/visual-types";

/*
  Os simuladores. O modelo escolhe um modelo do catálogo e preenche rótulos
  e faixas; a matemática é nossa e é de brinquedo, de propósito: um botão,
  uma curva, uma leitura. O estado inicial já mostra a conclusão — a
  maioria nunca mexe no controle.

  Geometria comum: viewBox 560×250, área útil de x=48 a x=540, base em 214.
*/

const W = 560;
const H = 250;
const X0 = 48;
const X1 = 540;
const TOP = 22;
const BASE = 214;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r1 = (n: number) => Math.round(n * 10) / 10;

function fmt(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 100) return String(Math.round(v));
  if (abs >= 10) return v.toFixed(1).replace(/\.0$/, "");
  return v.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Caminho SVG por pontos já em coordenadas de tela. */
function path(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)},${r1(y)}`).join(" ");
}

// erf de Abramowitz–Stegun, suficiente para sombrear sinos
function erf(x: number): number {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const cdf = (x: number, mu = 0) => 0.5 * (1 + erf((x - mu) / Math.SQRT2));
const pdf = (x: number, mu = 0) => Math.exp(-0.5 * (x - mu) ** 2) / Math.sqrt(2 * Math.PI);

type Readout = { label: string; value: string; tone?: "accent" | "muted" };

type Rendered = { chart: React.ReactNode; readouts: Readout[]; display?: string };

// --------------------------------------------------------------- moldura

function Axis({ xLabel, yLabel }: { xLabel?: string; yLabel?: string }) {
  return (
    <g>
      <line x1={X0} y1={BASE} x2={X1} y2={BASE} stroke="var(--v-200)" strokeWidth={1.25} />
      <line x1={X0} y1={TOP} x2={X0} y2={BASE} stroke="var(--v-200)" strokeWidth={1.25} />
      {xLabel && (
        <text x={X1} y={BASE + 26} textAnchor="end" className="vz-svg-label">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={X0} y={TOP - 8} className="vz-svg-label">
          {yLabel}
        </text>
      )}
    </g>
  );
}

function Marker({ x, label, tone = "var(--ink-3)" }: { x: number; label: string; tone?: string }) {
  const left = x > (X0 + X1) / 2;
  return (
    <g>
      <line x1={x} y1={TOP} x2={x} y2={BASE} stroke={tone} strokeWidth={1} strokeDasharray="2 3" />
      <text x={left ? x - 6 : x + 6} y={TOP + 10} textAnchor={left ? "end" : "start"} className="vz-svg-label" fill={tone}>
        {label}
      </text>
    </g>
  );
}

// ------------------------------------------------------------ catálogo

function samplingTemperature(sim: Sim, t: number, seed: number): Rendered {
  const labels = sim.labels.length >= 2 ? sim.labels : ["option A", "option B", "option C"];
  const scores = sim.values.length === labels.length ? sim.values : labels.map((_, i) => 6 - i * 1.5);
  const z = scores.map((s) => s / Math.max(t, 0.05));
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const sum = e.reduce((a, b) => a + b, 0);
  const p = e.map((v) => v / sum);
  const entropy = -p.reduce((a, v) => a + (v > 0 ? v * Math.log2(v) : 0), 0);

  // Amostra determinística por semente: o botão "sample" troca a semente
  let u = ((Math.sin(seed * 9301 + 49297) * 233280) % 1 + 1) % 1;
  let pick = 0;
  for (let i = 0; i < p.length; i++) {
    u -= p[i];
    if (u <= 0) {
      pick = i;
      break;
    }
  }

  const band = (X1 - X0) / labels.length;
  const bw = Math.min(64, band * 0.56);
  return {
    chart: (
      <g>
        <Axis yLabel="probability" />
        {p.map((v, i) => {
          const x = X0 + band * i + band / 2;
          const h = (BASE - TOP - 14) * v;
          return (
            <g key={i}>
              <rect
                x={x - bw / 2}
                y={BASE - h}
                width={bw}
                height={h}
                className="vz-live"
                fill={i === pick && seed > 0 ? "var(--moss)" : "var(--ink-2)"}
                opacity={i === pick && seed > 0 ? 1 : 0.55}
              />
              <text x={x} y={BASE - h - 6} textAnchor="middle" className="vz-svg-value">
                {pct(v)}
              </text>
              <text x={x} y={BASE + 16} textAnchor="middle" className="vz-svg-label">
                {labels[i].slice(0, 16)}
              </text>
            </g>
          );
        })}
      </g>
    ),
    readouts: [
      { label: "top choice", value: pct(Math.max(...p)) },
      { label: "uncertainty", value: `${fmt(entropy)} bits` },
      ...(seed > 0 ? [{ label: "sampled", value: labels[pick], tone: "accent" as const }] : []),
    ],
  };
}

function gradientDescent(sim: Sim, lr: number): Rendered {
  // Perda f(w) = w², w0 = -1: w ← w(1 − 2η). Converge abaixo de 1, oscila acima de 0.5.
  const f = (w: number) => w * w;
  const sx = (w: number) => lerp(X0, X1, (w + 1.5) / 3);
  const sy = (y: number) => BASE - (clamp(y, 0, 2.25) / 2.25) * (BASE - TOP);
  const curve: [number, number][] = Array.from({ length: 61 }, (_, i) => {
    const w = -1.5 + (3 * i) / 60;
    return [sx(w), sy(f(w))];
  });
  const steps: number[] = [-1];
  for (let i = 0; i < 12; i++) steps.push(steps[i] * (1 - 2 * lr));
  const final = f(steps[steps.length - 1]);
  const diverged = Math.abs(steps[steps.length - 1]) > 1.5;
  const shown = steps.map((w) => clamp(w, -1.5, 1.5));

  return {
    chart: (
      <g>
        <Axis xLabel="weight" yLabel={sim.y_label || "loss"} />
        <path d={path(curve)} fill="none" stroke="var(--v-200)" strokeWidth={1.5} />
        <path
          d={path(shown.map((w) => [sx(w), sy(f(w))]))}
          fill="none"
          stroke="var(--moss)"
          strokeWidth={1}
          className="vz-live"
        />
        {shown.map((w, i) => (
          <circle
            key={i}
            cx={sx(w)}
            cy={sy(f(w))}
            r={i === 0 ? 4 : 3}
            fill={i === shown.length - 1 ? "var(--moss)" : "var(--v-50)"}
            stroke="var(--moss)"
            strokeWidth={1}
            className="vz-live"
          />
        ))}
      </g>
    ),
    readouts: [
      {
        label: "loss after 12 steps",
        value: diverged ? "diverged" : final < 0.001 ? "< 0.001" : fmt(final, 3),
        tone: diverged ? "muted" : "accent",
      },
      {
        label: "behaviour",
        value: lr < 0.5 ? "smooth descent" : lr < 1 ? "zig-zags in" : "blows up",
      },
    ],
  };
}

function thresholdTradeoff(sim: Sim, t: number): Rendered {
  const d = clamp(sim.values[0] ?? 2, 0.3, 5);
  const [neg, pos] = sim.labels.length >= 2 ? sim.labels : ["negatives", "positives"];
  const lo = -3.2;
  const hi = d + 3.2;
  const cut = lerp(lo + 1, hi - 1, t);
  const sx = (x: number) => lerp(X0, X1, (x - lo) / (hi - lo));
  const peak = pdf(0);
  const sy = (y: number) => BASE - (y / peak) * (BASE - TOP - 18);
  const xs = Array.from({ length: 81 }, (_, i) => lerp(lo, hi, i / 80));
  const curve = (mu: number) => path(xs.map((x) => [sx(x), sy(pdf(x, mu))]));
  const area = (mu: number, from: number, to: number) => {
    const seg = xs.filter((x) => x >= from && x <= to);
    if (seg.length < 2) return "";
    return `${path([[sx(seg[0]), BASE], ...seg.map((x) => [sx(x), sy(pdf(x, mu))] as [number, number]), [sx(seg[seg.length - 1]), BASE]])} Z`;
  };
  const falseAlarms = 1 - cdf(cut, 0);
  const misses = cdf(cut, d);

  return {
    chart: (
      <g>
        <Axis xLabel="score" />
        <path d={area(0, cut, hi)} fill="var(--ink-2)" opacity={0.18} className="vz-live" />
        <path d={area(d, lo, cut)} fill="var(--moss)" opacity={0.22} className="vz-live" />
        <path d={curve(0)} fill="none" stroke="var(--ink-2)" strokeWidth={1.25} />
        <path d={curve(d)} fill="none" stroke="var(--moss)" strokeWidth={1.25} />
        <text x={sx(0)} y={sy(peak) - 6} textAnchor="middle" className="vz-svg-label">
          {neg}
        </text>
        <text x={sx(d)} y={sy(peak) - 6} textAnchor="middle" className="vz-svg-label" fill="var(--moss)">
          {pos}
        </text>
        <line x1={sx(cut)} y1={TOP} x2={sx(cut)} y2={BASE} stroke="var(--ink)" strokeWidth={1.25} className="vz-live" />
        <text x={sx(cut)} y={BASE + 16} textAnchor="middle" className="vz-svg-value">
          threshold
        </text>
      </g>
    ),
    readouts: [
      { label: `${neg} flagged`, value: pct(falseAlarms) },
      { label: `${pos} missed`, value: pct(misses), tone: "accent" },
    ],
  };
}

function magnitude(exp: number, unit: string): string {
  const v = 10 ** exp;
  const units: [number, string][] = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [n, s] of units) if (v >= n) return `${fmt(v / n, 1)}${s}${unit ? ` ${unit}` : ""}`;
  return `${fmt(v, 1)}${unit ? ` ${unit}` : ""}`;
}

function scalingLaw(sim: Sim, x: number): Rendered {
  const alpha = clamp(sim.values[0] ?? 0.3, 0.02, 0.8);
  const floor = clamp(sim.values[1] ?? 0.3, 0, 0.9);
  const loss = (v: number) => floor + (1 - floor) * 10 ** (-alpha * (v - sim.x_min));
  const sx = (v: number) => lerp(X0, X1, (v - sim.x_min) / (sim.x_max - sim.x_min));
  const sy = (y: number) => BASE - y * (BASE - TOP - 10);
  const xs = Array.from({ length: 61 }, (_, i) => lerp(sim.x_min, sim.x_max, i / 60));
  const ticks: number[] = [];
  for (let e = Math.ceil(sim.x_min); e <= Math.floor(sim.x_max); e++) ticks.push(e);
  const gain = 1 - 10 ** -alpha;

  return {
    chart: (
      <g>
        <Axis yLabel={sim.y_label || "loss"} />
        <line x1={X0} y1={sy(floor)} x2={X1} y2={sy(floor)} stroke="var(--v-200)" strokeDasharray="4 4" />
        <text x={X1} y={sy(floor) - 6} textAnchor="end" className="vz-svg-label">
          floor
        </text>
        <path d={path(xs.map((v) => [sx(v), sy(loss(v))]))} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} />
        {ticks.map((e) => (
          <text key={e} x={sx(e)} y={BASE + 16} textAnchor="middle" className="vz-svg-label">
            {magnitude(e, "")}
          </text>
        ))}
        {sim.paper_x != null && <Marker x={sx(sim.paper_x)} label={sim.paper_note ?? "paper"} tone="var(--moss)" />}
        <circle cx={sx(x)} cy={sy(loss(x))} r={5} fill="var(--moss)" className="vz-live" />
      </g>
    ),
    readouts: [
      { label: sim.x_label || "scale", value: magnitude(x, sim.x_unit) },
      { label: sim.y_label || "loss", value: fmt(loss(x), 3), tone: "accent" },
      { label: "10× more cuts the gap by", value: pct(gain), tone: "muted" },
    ],
    display: magnitude(x, sim.x_unit),
  };
}

function topkRetrieval(sim: Sim, k: number): Rendered {
  const relevantCount = Math.round(clamp(sim.values[0] ?? 4, 1, 10));
  // Relevantes mais densos no topo do ranking, rarefeitos no fim
  const relevant = new Set<number>();
  for (let i = 0; i < relevantCount; i++) {
    let at = Math.min(19, Math.round(19 * (i / relevantCount) ** 1.7));
    while (relevant.has(at)) at = (at + 1) % 20;
    relevant.add(at);
  }
  const n = Math.round(k);
  const hits = [...relevant].filter((r) => r < n).length;
  const cellW = (X1 - X0) / 20;

  return {
    chart: (
      <g>
        <text x={X0} y={TOP + 10} className="vz-svg-label">
          ranked results, best first
        </text>
        {Array.from({ length: 20 }, (_, i) => {
          const inK = i < n;
          const rel = relevant.has(i);
          return (
            <g key={i}>
              <rect
                x={X0 + i * cellW + 2}
                y={TOP + 40}
                width={cellW - 4}
                height={96}
                fill={rel ? "var(--moss)" : "var(--v-200)"}
                opacity={inK ? 1 : 0.28}
                className="vz-live"
              />
              <text x={X0 + i * cellW + cellW / 2} y={TOP + 154} textAnchor="middle" className="vz-svg-label">
                {i + 1}
              </text>
            </g>
          );
        })}
        <line
          x1={X0 + n * cellW}
          y1={TOP + 30}
          x2={X0 + n * cellW}
          y2={TOP + 146}
          stroke="var(--ink)"
          strokeWidth={1.25}
          className="vz-live"
        />
        <text x={X0 + n * cellW} y={TOP + 24} textAnchor="middle" className="vz-svg-value">
          k = {n}
        </text>
      </g>
    ),
    readouts: [
      { label: "relevant found", value: `${hits} of ${relevantCount}`, tone: "accent" },
      { label: "precision", value: pct(hits / Math.max(n, 1)) },
      { label: "recall", value: pct(hits / relevantCount) },
    ],
  };
}

function quantization(sim: Sim, bits: number): Rendered {
  const b = Math.round(bits);
  const levels = 2 ** b;
  const signal = (t: number) => 0.62 * Math.sin(t * 2 * Math.PI * 1.3) + 0.3 * Math.sin(t * 2 * Math.PI * 3.7 + 1);
  const q = (v: number) => Math.round(((v + 1) / 2) * (levels - 1)) / (levels - 1) * 2 - 1;
  const xs = Array.from({ length: 97 }, (_, i) => i / 96);
  const sx = (t: number) => lerp(X0, X1, t);
  const sy = (v: number) => lerp(BASE - 6, TOP + 6, (v + 1) / 2);
  let err = 0;
  const stepped: [number, number][] = [];
  xs.forEach((t, i) => {
    const v = q(signal(t));
    err += (v - signal(t)) ** 2;
    if (i > 0) stepped.push([sx(t), stepped[stepped.length - 1][1]]);
    stepped.push([sx(t), sy(v)]);
  });
  const rms = Math.sqrt(err / xs.length);

  return {
    chart: (
      <g>
        <Axis xLabel="weights" yLabel="value" />
        <path d={path(xs.map((t) => [sx(t), sy(signal(t))]))} fill="none" stroke="var(--v-200)" strokeWidth={2.5} />
        <path d={path(stepped)} fill="none" stroke="var(--moss)" strokeWidth={1.25} className="vz-live" />
      </g>
    ),
    readouts: [
      { label: "distinct values", value: levels > 9999 ? levels.toExponential(0) : String(levels) },
      { label: "rounding error", value: fmt(rms, 3), tone: "accent" },
      { label: "size vs 16-bit", value: `${fmt(16 / b, 1)}× smaller`, tone: "muted" },
    ],
    display: `${b} bits`,
  };
}

function binom(n: number, p: number): number {
  // P(maioria acerta): mais da metade das n tentativas certas; empate conta meio
  let total = 0;
  let c = 1;
  for (let k = 0; k <= n; k++) {
    if (k > 0) c = (c * (n - k + 1)) / k;
    const pk = c * p ** k * (1 - p) ** (n - k);
    if (2 * k > n) total += pk;
    else if (2 * k === n) total += pk / 2;
  }
  return total;
}

function majorityVote(sim: Sim, n: number): Rendered {
  const p = clamp(sim.values[0] ?? 0.6, 0.02, 0.98);
  const N = Math.round(n);
  const maxN = Math.max(2, Math.round(sim.x_max));
  const sx = (v: number) => lerp(X0, X1, (v - 1) / (maxN - 1));
  const sy = (y: number) => BASE - y * (BASE - TOP - 10);
  const xs = Array.from({ length: maxN }, (_, i) => i + 1);
  const acc = binom(N, p);

  return {
    chart: (
      <g>
        <Axis xLabel="attempts" yLabel="majority correct" />
        <line x1={X0} y1={sy(p)} x2={X1} y2={sy(p)} stroke="var(--v-200)" strokeDasharray="4 4" />
        <text x={X1} y={sy(p) - 6} textAnchor="end" className="vz-svg-label">
          one attempt · {pct(p)}
        </text>
        <path d={path(xs.map((v) => [sx(v), sy(binom(v, p))]))} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} />
        {sim.paper_x != null && <Marker x={sx(sim.paper_x)} label={sim.paper_note ?? "paper"} tone="var(--moss)" />}
        <circle cx={sx(N)} cy={sy(acc)} r={5} fill="var(--moss)" className="vz-live" />
      </g>
    ),
    readouts: [
      { label: "attempts", value: String(N) },
      { label: "majority correct", value: pct(acc), tone: "accent" },
      { label: "vs one attempt", value: `${acc >= p ? "+" : "−"}${Math.abs(Math.round((acc - p) * 100))} pts`, tone: "muted" },
    ],
    display: String(N),
  };
}

const SHAPES: Record<CurveShape, (t: number) => number> = {
  rise_then_fall: (t) => Math.exp(-(((t - 0.42) / 0.26) ** 2)),
  saturating: (t) => 1 - Math.exp(-4 * t),
  decaying: (t) => Math.exp(-3 * t),
  power_law: (t) => 0.08 / (t + 0.08),
  s_curve: (t) => 1 / (1 + Math.exp(-12 * (t - 0.5))),
};

function tradeoffCurve(sim: Sim, x: number): Rendered {
  const shape = SHAPES[sim.shape ?? "saturating"] ?? SHAPES.saturating;
  const t = (x - sim.x_min) / (sim.x_max - sim.x_min || 1);
  const sx = (u: number) => lerp(X0, X1, u);
  const sy = (y: number) => BASE - y * (BASE - TOP - 10);
  const us = Array.from({ length: 61 }, (_, i) => i / 60);
  const [low, high] = [sim.labels[0], sim.labels[1]];
  const zone = t < 0.34 ? low : t > 0.66 ? high : undefined;

  return {
    chart: (
      <g>
        <Axis xLabel={sim.x_label} yLabel={sim.y_label} />
        <path d={path(us.map((u) => [sx(u), sy(shape(u))]))} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} />
        {low && (
          <text x={X0 + 6} y={BASE + 16} className="vz-svg-label">
            {low}
          </text>
        )}
        {high && (
          <text x={X1} y={BASE + 16} textAnchor="end" className="vz-svg-label">
            {high}
          </text>
        )}
        {sim.paper_x != null && (
          <Marker x={sx((sim.paper_x - sim.x_min) / (sim.x_max - sim.x_min || 1))} label={sim.paper_note ?? "paper"} tone="var(--moss)" />
        )}
        <circle cx={sx(t)} cy={sy(shape(t))} r={5} fill="var(--moss)" className="vz-live" />
      </g>
    ),
    readouts: [
      // A curva é ilustrativa: o nível sai em palavras para não parecer dado do paper
      { label: sim.y_label || "outcome", value: shape(t) > 0.75 ? "high" : shape(t) > 0.4 ? "medium" : "low", tone: "accent" },
      ...(zone ? [{ label: "here", value: zone, tone: "muted" as const }] : []),
    ],
  };
}

// ------------------------------------------------------------- moldura

const INTEGER = new Set(["topk_retrieval", "quantization", "majority_vote"]);

function render(sim: Sim, x: number, seed: number): Rendered | null {
  switch (sim.template) {
    case "sampling_temperature":
      return samplingTemperature(sim, x, seed);
    case "gradient_descent":
      return gradientDescent(sim, x);
    case "threshold_tradeoff":
      return thresholdTradeoff(sim, x);
    case "scaling_law":
      return scalingLaw(sim, x);
    case "topk_retrieval":
      return topkRetrieval(sim, x);
    case "quantization":
      return quantization(sim, x);
    case "majority_vote":
      return majorityVote(sim, x);
    case "tradeoff_curve":
      return tradeoffCurve(sim, x);
    default:
      return null;
  }
}

export function SimLab({ sim }: { sim: Sim }) {
  const id = useId();
  const lo = sim.x_min;
  const hi = sim.x_max > sim.x_min ? sim.x_max : sim.x_min + 1;
  const integer = INTEGER.has(sim.template);
  const step = integer ? 1 : (hi - lo) / 200;
  const [x, setX] = useState(() => clamp(sim.x_default, lo, hi));
  const [seed, setSeed] = useState(0);
  const out = useMemo(() => render(sim, x, seed), [sim, x, seed]);
  if (!out) return null;

  const shown = out.display ?? `${fmt(x)}${sim.x_unit ? ` ${sim.x_unit}` : ""}`;

  return (
    <figure className="vz-lab m-0" data-reveal="fade" data-delay="60">
      <p className="vz-lab-question">{sim.question}</p>

      <svg viewBox={`0 0 ${W} ${H}`} className="vz-lab-svg" role="img" aria-label={`${sim.title}: ${sim.takeaway}`}>
        {out.chart}
      </svg>

      <div className="vz-controls">
        <label htmlFor={id} className="vz-slider-label">
          <span>{sim.x_label}</span>
          <span className="tnum vz-slider-value">{shown}</span>
        </label>
        <input
          id={id}
          type="range"
          min={lo}
          max={hi}
          step={step}
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
          className="vz-slider"
          data-cur="drag"
        />
        {sim.paper_x != null && sim.paper_note && (
          <button type="button" className="op-link vz-preset" onClick={() => setX(clamp(sim.paper_x!, lo, hi))}>
            Paper&apos;s setting
          </button>
        )}
        {sim.template === "sampling_temperature" && (
          <button type="button" className="op-link vz-preset" onClick={() => setSeed((s) => s + 1)}>
            Sample once
          </button>
        )}
      </div>

      <dl className="vz-readouts" aria-live="polite">
        {out.readouts.map((r) => (
          <div key={r.label} className="vz-readout">
            <dt>{r.label}</dt>
            <dd className="tnum" data-tone={r.tone}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      <figcaption className="vz-takeaway">
        <span>{sim.takeaway}</span>
        <span className="vz-toy">Illustrative model, not the paper&apos;s data</span>
      </figcaption>
    </figure>
  );
}
