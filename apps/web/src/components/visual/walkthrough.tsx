"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import type {
  FlowEdge,
  FlowNode,
  Walkthrough as WalkthroughData,
} from "@/lib/visual-types";

/*
  O passo a passo do método. O diagrama do paper fica parado; cada etapa
  acende os blocos que trabalham naquele momento, e as setas que chegam
  neles correm como dado passando. Ao lado, o que a etapa faz e o que
  acontece com o exemplo do paper ali. Avança por botão, pelos traços da
  régua, pelas setas do teclado ou no play.
*/

const BOX_W = 210;
const BOX_H = 46;
const GAP = 38;
const LANE = 18;
const LABEL_W = 120;
const PLAY_MS = 4800;

type Placed = { node: FlowNode; y: number; lines: string[] };
type Routed = {
  edge: FlowEdge;
  d: string;
  back: boolean;
  side: boolean;
  labelX: number;
  labelY: number;
};

/** Quebra o rótulo em até duas linhas de ~22 caracteres. */
function wrap(label: string): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + " " + w).length > 22 && lines.length < 2) lines.push(w);
    else lines[lines.length - 1] = cur ? `${cur} ${w}` : w;
  }
  return lines;
}

/**
 * Ordem vertical: a ordem em que as etapas acendem os blocos; os que nenhuma
 * etapa acende vão para o fim. Setas entre vizinhos são retas; as que pulam
 * blocos ou voltam correm por faixas à direita, uma faixa por seta.
 */
function layout(data: WalkthroughData) {
  const order: string[] = [];
  for (const s of data.stages)
    for (const id of s.nodes) if (!order.includes(id)) order.push(id);
  for (const n of data.nodes) if (!order.includes(n.id)) order.push(n.id);
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const placed: Placed[] = order
    .map((id) => byId.get(id))
    .filter((n): n is FlowNode => !!n)
    .map((node, i) => ({
      node,
      y: i * (BOX_H + GAP),
      lines: wrap(node.label),
    }));
  const index = new Map(placed.map((p, i) => [p.node.id, i]));

  let lanes = 0;
  const routed: Routed[] = [];
  for (const edge of data.edges) {
    const a = index.get(edge.source);
    const b = index.get(edge.target);
    if (a === undefined || b === undefined) continue;
    const ya = placed[a].y;
    const yb = placed[b].y;
    if (b === a + 1) {
      const top = ya + BOX_H;
      routed.push({
        edge,
        d: `M${BOX_W / 2} ${top} V${yb - 2}`,
        back: false,
        side: false,
        labelX: BOX_W / 2 + 10,
        labelY: top + GAP / 2 + 4,
      });
    } else {
      const x = BOX_W + 14 + lanes * LANE;
      lanes += 1;
      const y1 = ya + BOX_H / 2 + (b > a ? 6 : -6);
      const y2 = yb + BOX_H / 2 + (b > a ? -6 : 6);
      routed.push({
        edge,
        d: `M${BOX_W} ${y1} H${x} V${y2} H${BOX_W + 2}`,
        back: b < a,
        side: true,
        labelX: x + 6,
        labelY: (y1 + y2) / 2 + 4,
      });
    }
  }
  const height = placed.length * (BOX_H + GAP) - GAP;
  const width = BOX_W + 14 + lanes * LANE + LABEL_W;
  return { placed, routed, width, height: Math.max(height, BOX_H) };
}

export function Walkthrough({ data }: { data: WalkthroughData }) {
  const { placed, routed, width, height } = useMemo(() => layout(data), [data]);
  const total = data.stages.length;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const stage = data.stages[step];
  const lit = new Set(stage.nodes);
  const seen = new Set(data.stages.slice(0, step).flatMap((s) => s.nodes));
  const labels = new Map(data.nodes.map((n) => [n.id, n.label]));

  const go = useCallback(
    (next: number) => setStep(Math.max(0, Math.min(total - 1, next))),
    [total],
  );

  useEffect(() => {
    if (!playing) return;
    if (step >= total - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), PLAY_MS);
    return () => window.clearTimeout(t);
  }, [playing, step, total]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setPlaying(false);
      go(step + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPlaying(false);
      go(step - 1);
    }
  }

  const last = step === total - 1;

  return (
    <div className="vz-wt" onKeyDown={onKey}>
      <figure className="vz-wt-example" data-reveal="fade" data-delay="60">
        <figcaption className="vz-wt-example-head">
          <span>{data.example_title}</span>
          <span
            className="vz-wt-source"
            data-illustrative={data.illustrative ? "" : undefined}
          >
            {data.illustrative
              ? "Illustrative example"
              : `From the paper · ${data.example_source}`}
          </span>
        </figcaption>
        <p className="vz-wt-input">{data.input}</p>
      </figure>

      <div className="vz-wt-body">
        <div className="vz-wt-panel">
          <div className="vz-wt-count tnum" aria-hidden="true">
            Step {step + 1} of {total}
          </div>
          <div aria-live="polite">
            <h3 className="vz-wt-title">{stage.title}</h3>
            <p className="vz-wt-says">{stage.says}</p>
            <ul className="vz-wt-chips" aria-label="Blocks at work">
              {stage.nodes.map((id) => (
                <li key={id}>{labels.get(id)}</li>
              ))}
            </ul>
            <div className="vz-wt-ex" data-format={stage.example_format}>
              <span className="vz-wt-ex-label">The example here</span>
              <p>{stage.example}</p>
            </div>
            {last && (
              <div className="vz-wt-out">
                <span className="vz-wt-ex-label">What comes out</span>
                <p>{data.output}</p>
              </div>
            )}
          </div>

          <div className="vz-wt-controls">
            <button
              type="button"
              className="vz-wt-btn"
              onClick={() => {
                setPlaying(false);
                go(step - 1);
              }}
              disabled={step === 0}
              aria-label="Previous step"
            >
              <Icon name="arrow-left" />
            </button>
            <ol className="vz-wt-ticks">
              {data.stages.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="vz-wt-tick"
                    data-state={
                      i === step ? "now" : i < step ? "done" : undefined
                    }
                    aria-label={`Step ${i + 1}: ${s.title}`}
                    aria-current={i === step ? "step" : undefined}
                    onClick={() => {
                      setPlaying(false);
                      go(i);
                    }}
                  />
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="vz-wt-btn"
              onClick={() => {
                setPlaying(false);
                go(step + 1);
              }}
              disabled={last}
              aria-label="Next step"
            >
              <Icon name="arrow-right" />
            </button>
            <button
              type="button"
              className="vz-wt-play"
              onClick={() => {
                if (last) setStep(0);
                setPlaying((p) => !p || last);
              }}
              aria-pressed={playing}
            >
              {playing ? "Pause" : last ? "Replay" : "Play"}
            </button>
          </div>
        </div>

        <svg
          className="vz-wt-diagram"
          viewBox={`-2 -2 ${width + 4} ${height + 4}`}
          role="img"
          aria-label={`Diagram of the method: ${placed.map((p) => p.node.label).join(", ")}. Lit now: ${stage.nodes
            .map((id) => labels.get(id))
            .join(", ")}.`}
        >
          <defs>
            <marker
              id="vz-wt-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M1 1 7 4 1 7"
                fill="none"
                stroke="context-stroke"
                strokeWidth="1.2"
              />
            </marker>
          </defs>

          {routed
            .map((r, i) => ({
              r,
              i,
              flowing:
                lit.has(r.edge.target) &&
                (lit.has(r.edge.source) || seen.has(r.edge.source)),
            }))
            // As setas da etapa vêm por último: no SVG, quem vem depois fica por cima
            .sort((a, b) => Number(a.flowing) - Number(b.flowing))
            .map(({ r, i, flowing }) => (
              <g
                key={i}
                className="vz-wt-edge"
                data-on={flowing ? "" : undefined}
                data-back={r.back ? "" : undefined}
                data-side={r.side ? "" : undefined}
              >
                <path d={r.d} markerEnd="url(#vz-wt-arrow)" />
                {/* Setas laterais só dizem o nome quando são da etapa: o resto fica em silêncio */}
                {r.edge.label && (
                  <text x={r.labelX} y={r.labelY} className="vz-wt-edge-label">
                    {r.edge.label}
                  </text>
                )}
              </g>
            ))}

          {placed.map((p) => (
            <g
              key={p.node.id}
              className="vz-wt-node"
              data-kind={p.node.kind}
              data-state={
                lit.has(p.node.id)
                  ? "now"
                  : seen.has(p.node.id)
                    ? "done"
                    : undefined
              }
              transform={`translate(0 ${p.y})`}
            >
              <rect width={BOX_W} height={BOX_H} />
              {p.lines.map((line, i) => (
                <text
                  key={i}
                  x={BOX_W / 2}
                  y={BOX_H / 2 + (i - (p.lines.length - 1) / 2) * 15 + 5}
                  textAnchor="middle"
                >
                  {line}
                </text>
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
