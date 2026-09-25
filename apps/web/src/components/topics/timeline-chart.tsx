"use client";

import { useState } from "react";
import type { TopicPoint } from "@/lib/api";

/**
 * Papers por semana, como uma prancha do Offprint: barras em tinta que
 * crescem da base ao entrar em tela, a última semana com papers em musgo, eixo
 * de fio de cabelo, rótulos em mono. O hover troca a legenda de baixo.
 */

const X0 = 40;
const X1 = 548;
const BASE = 250;
const TOP = 60;

/** Datas em UTC: a semana vem como meia-noite UTC e não pode virar a véspera. */
function weekLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace("Sept", "Sep")
    .toLowerCase();
}

export function TimelineChart({ points }: { points: TopicPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <p className="op-label m-0 border-y border-border py-[calc(40*var(--px))]">
        No timeline yet — snapshots start with the next weekly run
      </p>
    );
  }

  const max = Math.max(...points.map((p) => p.papers), 1);
  const n = points.length;
  const step = (X1 - X0) / n;
  const width = Math.max(4, Math.min(30, step * 0.6));
  const last = n - 1;
  // Em musgo: a semana sob o ponteiro, ou a última que teve papers
  const latest = points.reduce((a, p, i) => (p.papers > 0 ? i : a), last);
  const focus = hovered ?? latest;
  const peak = points.reduce((a, p, i) => (p.papers > points[a].papers ? i : a), 0);

  return (
    <figure className="op-plate m-0" data-reveal="plate" data-delay="0">
      <svg viewBox="0 0 560 300" role="img" aria-label={`Papers per week over ${n} weeks; peak ${points[peak].papers} in the week of ${weekLabel(points[peak].week)}`}>
        <line x1={X0} y1={BASE} x2={X1} y2={BASE} stroke="var(--v-200)" strokeWidth={1.25} />
        <line x1={X0} y1={50} x2={X0} y2={BASE} stroke="var(--v-200)" strokeWidth={1.25} />

        {points.map((p, i) => {
          const h = p.papers > 0 ? Math.max(2, ((BASE - TOP) * p.papers) / max) : 0;
          const x = X0 + i * step + (step - width) / 2;
          return (
            <g key={p.week}>
              <rect
                data-bar=""
                x={x}
                y={BASE - h}
                width={width}
                height={h}
                fill={i === focus ? "var(--moss)" : "var(--ink)"}
                style={{ transitionDelay: `${i * 60}ms` }}
              />
              {/* Área de hover: a coluna inteira */}
              <rect
                x={X0 + i * step}
                y={TOP - 10}
                width={step}
                height={BASE - TOP + 10}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}

        <text x={34} y={64} textAnchor="end" className="op-svg-label" fontSize={9} letterSpacing={1.26} fill="var(--ink-3)">
          {max}
        </text>
        <text x={X0} y={272} className="op-svg-label" fontSize={9} letterSpacing={1.26} fill="var(--ink-3)">
          {weekLabel(points[0].week).toUpperCase()}
        </text>
        <text x={X1} y={272} textAnchor="end" className="op-svg-label" fontSize={9} letterSpacing={1.26} fill="var(--ink-3)">
          {weekLabel(points[last].week).toUpperCase()}
        </text>
      </svg>

      <figcaption className="op-figcaption">
        <span>
          week of {weekLabel(points[focus].week)} · {points[focus].papers} paper
          {points[focus].papers === 1 ? "" : "s"}
          {points[focus].citations > 0 && ` · ${points[focus].citations} citations`}
        </span>
        <span>
          peak {points[peak].papers} · {weekLabel(points[peak].week)}
        </span>
      </figcaption>
    </figure>
  );
}
