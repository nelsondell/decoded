"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import type {
  Scene,
  SceneActor,
  SceneBeat,
  ScenePanel,
} from "@/lib/visual-types";

import { sceneIcon } from "./scene-icons";

/*
  A cena antes × depois. Os dois quadros mostram a mesma situação com as
  mesmas peças; muda só o que o paper muda. Toca uma vez quando entra em
  tela e para no fim, com as marcas e a legenda à mostra. "Play again"
  recomeça. Sem animação (reduced motion), mostra direto o fim.

  Nada se sobrepõe, por construção:
  - a fala vai numa faixa reservada no topo, como legenda ("Agent: ..."),
    uma de cada vez; peças e traços não entram nela;
  - cada peça ocupa um retângulo (ícone, selo, nome e medidor); se cair em
    cima de outra peça ou de um traço, vai para a vaga livre mais próxima;
  - traços que nascem numa peça começam na borda dela, sem riscar o nome.
*/

const W = 360;
const H = 216;
const LANE = 26;
const COLS = 24;
const ROWS = 12;
const CW = W / COLS;
const CH = (H - LANE) / ROWS;
const DURATION = 5200;
const PAD = 4;

type Pt = { x: number; y: number };
type Box = { x0: number; y0: number; x1: number; y1: number };
type Line = { samples: Pt[]; ends: Pt[] };

const at = (col: number, row: number): Pt => ({
  x: col * CW + CW / 2,
  y: LANE + row * CH + CH / 2,
});
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const progress = (tau: number, t: number, span: number) =>
  clamp((tau - t) / span);

const MARK_ICON = {
  ok: "check",
  fail: "cross",
  wait: "clock",
  fast: "bolt",
} as const;

const hits = (a: Box, b: Box) =>
  a.x0 < b.x1 + PAD &&
  b.x0 < a.x1 + PAD &&
  a.y0 < b.y1 + PAD &&
  b.y0 < a.y1 + PAD;
/** Dentro do quadro e abaixo da faixa da fala. */
const inside = (b: Box) =>
  b.x0 >= 2 && b.y0 >= LANE + 2 && b.x1 <= W - 2 && b.y1 <= H - 2;
const contains = (b: Box, p: Pt) =>
  p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1;

/** Retângulo de uma peça: selo em cima, nome e medidor embaixo. */
function footprint(actor: SceneActor, p: Pt, metered: boolean): Box {
  const half = Math.max(actor.label.length * 3.2 + 4, metered ? 32 : 24);
  return {
    x0: p.x - half,
    y0: p.y - 28,
    x1: p.x + half,
    y1: p.y + (metered ? 46 : 22),
  };
}

function pathPoints(beat: SceneBeat): Pt[] {
  return beat.points
    .split(" ")
    .map((pair) => pair.split(",").map(Number))
    .filter(([c, r]) => Number.isFinite(c) && Number.isFinite(r))
    .map(([c, r]) => at(c, r));
}

/** Pontos ao longo do traço exatamente como ele é desenhado (reto ou curvo). */
function sample(pts: Pt[], smooth: boolean): Pt[] {
  const out: Pt[] = [];
  for (let j = 0; j < pts.length - 1; j++) {
    const p1 = pts[j];
    const p2 = pts[j + 1];
    const curved = smooth && pts.length > 2;
    const p0 = pts[j - 1] ?? p1;
    const p3 = pts[j + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      if (!curved) {
        out.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
      } else {
        const u = 1 - t;
        out.push({
          x:
            u * u * u * p1.x +
            3 * u * u * t * c1.x +
            3 * u * t * t * c2.x +
            t * t * t * p2.x,
          y:
            u * u * u * p1.y +
            3 * u * u * t * c1.y +
            3 * u * t * t * c2.y +
            t * t * t * p2.y,
        });
      }
    }
  }
  return out;
}

/** Um traço que nasce ou termina na peça é dela: não a empurra. */
function crosses(box: Box, here: Pt, lines: Line[]): boolean {
  return lines.some((l) => {
    // A ponta que nasce nesta peça pode encostar nela; o resto do traço, não
    const own = l.ends.filter(
      (e) => Math.hypot(e.x - here.x, e.y - here.y) < 26,
    );
    return l.samples.some(
      (s) =>
        contains(box, s) &&
        !own.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < 34),
    );
  });
}

/** Todas as células da grade, como candidatas a vaga. */
const CELLS: Pt[] = Array.from({ length: COLS * ROWS }, (_, i) =>
  at(i % COLS, Math.floor(i / COLS)),
);

/**
 * A vaga livre mais perto do ponto pedido: dentro do quadro, sem encostar
 * em outra peça e sem traço atravessando. Testa a grade inteira, então só
 * falha se o quadro realmente não tiver lugar.
 */
function settle(
  want: Pt,
  box: (p: Pt) => Box,
  taken: Box[],
  lines: Line[],
): Pt {
  const clear = (p: Pt) => {
    const b = box(p);
    return inside(b) && !taken.some((t) => hits(b, t));
  };
  const free = (p: Pt) => clear(p) && !crosses(box(p), p, lines);
  const nearest = (ok: (p: Pt) => boolean) => {
    if (ok(want)) return want;
    let best: Pt | null = null;
    let bestD = Infinity;
    for (const c of CELLS) {
      const d = Math.hypot(c.x - want.x, c.y - want.y);
      if (d < bestD && ok(c)) {
        best = c;
        bestD = d;
      }
    }
    return best;
  };
  // Primeiro sem nada em cima; depois aceitando traço por baixo (as peças têm
  // fundo, o traço some sob elas); peça sobre peça só se não houver lugar
  const spot = nearest(free) ?? nearest(clear);
  if (spot) return spot;
  const b = box(want);
  return {
    x: want.x + Math.max(0, 2 - b.x0) - Math.max(0, b.x1 - (W - 2)),
    y: want.y + Math.max(0, LANE + 2 - b.y0) - Math.max(0, b.y1 - (H - 2)),
  };
}

/** Leva a ponta do traço até a borda do retângulo da peça, para não riscar o nome. */
function trimEnd(end: Pt, next: Pt, box: Box): Pt {
  if (!contains(box, end)) return end;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    if (
      contains(box, {
        x: end.x + (next.x - end.x) * mid,
        y: end.y + (next.y - end.y) * mid,
      })
    )
      lo = mid;
    else hi = mid;
  }
  return { x: end.x + (next.x - end.x) * hi, y: end.y + (next.y - end.y) * hi };
}

type Layout = {
  start: Map<string, Pt>;
  targets: Map<ScenePanel, Map<number, Pt>>;
  paths: Map<ScenePanel, Map<number, Pt[]>>;
  metered: Set<string>;
};

function layoutScene(scene: Scene): Layout {
  const panels = [scene.before, scene.after];
  const metered = new Set(
    panels.flatMap((p) =>
      p.beats.filter((b) => b.kind === "fill").map((b) => b.actor),
    ),
  );
  const lines: Line[] = panels.flatMap((panel) =>
    panel.beats
      .filter((b) => b.kind === "path")
      .flatMap((b) => {
        const pts = pathPoints(b);
        return pts.length > 1
          ? [
              {
                samples: sample(pts, b.shape === "smooth"),
                ends: [pts[0], pts[pts.length - 1]],
              },
            ]
          : [];
      }),
  );

  const start = new Map<string, Pt>();
  const taken: Box[] = [];
  for (const a of scene.actors) {
    const p = settle(
      at(a.col, a.row),
      (q) => footprint(a, q, metered.has(a.id)),
      taken,
      lines,
    );
    start.set(a.id, p);
    taken.push(footprint(a, p, metered.has(a.id)));
  }

  const byId = new Map(scene.actors.map((a) => [a.id, a]));
  const targets = new Map<ScenePanel, Map<number, Pt>>();
  const paths = new Map<ScenePanel, Map<number, Pt[]>>();
  for (const panel of panels) {
    const now = new Map(start);
    const moved = new Map<number, Pt>();
    const drawn = new Map<number, Pt[]>();
    panel.beats.forEach((b, i) => {
      if (b.kind === "path") {
        const pts = pathPoints(b);
        if (pts.length < 2) return;
        // A ponta que cai numa peça para na borda dela
        const boxAt = (pt: Pt) => {
          const a = scene.actors.find(
            (o) =>
              Math.hypot(now.get(o.id)!.x - pt.x, now.get(o.id)!.y - pt.y) < 26,
          );
          return a ? footprint(a, now.get(a.id)!, metered.has(a.id)) : null;
        };
        const first = boxAt(pts[0]);
        const last = boxAt(pts[pts.length - 1]);
        // Anda pelo traço até sair de vez do retângulo da peça, nas duas pontas
        while (first && pts.length > 2 && contains(first, pts[1])) pts.shift();
        while (last && pts.length > 2 && contains(last, pts[pts.length - 2]))
          pts.pop();
        if (first) pts[0] = trimEnd(pts[0], pts[1], first);
        if (last)
          pts[pts.length - 1] = trimEnd(
            pts[pts.length - 1],
            pts[pts.length - 2],
            last,
          );
        drawn.set(i, pts);
        return;
      }
      const actor = byId.get(b.actor);
      if (b.kind !== "move" || !actor) return;
      const others = scene.actors
        .filter((o) => o.id !== actor.id)
        .map((o) => footprint(o, now.get(o.id)!, metered.has(o.id)));
      const p = settle(
        at(b.col, b.row),
        (q) => footprint(actor, q, metered.has(actor.id)),
        others,
        lines,
      );
      moved.set(i, p);
      now.set(actor.id, p);
    });
    targets.set(panel, moved);
    paths.set(panel, drawn);
  }
  return { start, targets, paths, metered };
}

/** Curva suave pelos pontos (Catmull-Rom em Bézier), ou segmentos retos. */
function pathD(pts: Pt[], smooth: boolean): string {
  if (!smooth || pts.length < 3)
    return pts.map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function Ground({ setting }: { setting: Scene["setting"] }) {
  if (setting === "road") {
    const top = LANE + CH * 4;
    const bottom = LANE + CH * 8;
    return (
      <g className="vz-sc-ground">
        <rect
          x={0}
          y={top}
          width={W}
          height={bottom - top}
          className="vz-sc-road"
        />
        <path d={`M0 ${top}H${W}M0 ${bottom}H${W}`} />
        <path d={`M0 ${(top + bottom) / 2}H${W}`} className="vz-sc-lane" />
      </g>
    );
  }
  if (setting === "desk") {
    return (
      <g className="vz-sc-ground">
        <path d={`M8 ${H - 6}H${W - 8}`} />
      </g>
    );
  }
  if (setting === "grid") {
    return (
      <g className="vz-sc-ground">
        {Array.from({ length: (COLS / 2) * (ROWS / 2) }, (_, i) => {
          const { x, y } = at(
            (i % (COLS / 2)) * 2,
            Math.floor(i / (COLS / 2)) * 2,
          );
          return <circle key={i} cx={x} cy={y} r={0.9} className="vz-sc-dot" />;
        })}
      </g>
    );
  }
  return null;
}

/** O estado de um quadro num instante tau (0 a 1). */
function Frame({
  scene,
  panel,
  layout,
  tau,
}: {
  scene: Scene;
  panel: ScenePanel;
  layout: Layout;
  tau: number;
}) {
  const pos = new Map(layout.start);
  const moves = layout.targets.get(panel)!;
  const drawn = layout.paths.get(panel)!;
  const dim = new Set<string>();
  const marks = new Map<string, { beat: SceneBeat; p: number }>();
  const fills = new Map<string, { beat: SceneBeat; p: number }>();
  let speech: { beat: SceneBeat; p: number } | null = null;

  panel.beats.forEach((b, i) => {
    if (tau < b.t) return;
    if (b.kind === "move") {
      const from = pos.get(b.actor);
      const to = moves.get(i);
      if (!from || !to) return;
      const p = ease(progress(tau, b.t, 0.14));
      pos.set(b.actor, {
        x: from.x + (to.x - from.x) * p,
        y: from.y + (to.y - from.y) * p,
      });
    } else if (b.kind === "dim") {
      dim.add(b.actor);
    } else if (b.kind === "mark") {
      marks.set(b.actor, { beat: b, p: progress(tau, b.t, 0.06) });
    } else if (b.kind === "fill") {
      fills.set(b.actor, { beat: b, p: ease(progress(tau, b.t, 0.3)) });
    } else if (b.kind === "say") {
      // Uma fala por vez, a mais recente, na faixa do topo
      speech = { beat: b, p: progress(tau, b.t, 0.05) };
    }
  });

  const line = speech as { beat: SceneBeat; p: number } | null;
  const speaker = line
    ? scene.actors.find((a) => a.id === line.beat.actor)
    : undefined;
  const caption = line && speaker ? `${speaker.label}: ${line.beat.text}` : "";
  const capW = Math.min(caption.length * 5.4 + 16, W - 4);
  const capX = speaker
    ? Math.min(Math.max(pos.get(speaker.id)!.x - capW / 2, 2), W - capW - 2)
    : 2;

  return (
    <>
      {panel.beats.map((b, i) => {
        const pts = drawn.get(i);
        if (b.kind !== "path" || !pts || tau < b.t) return null;
        return (
          <path
            key={`p${i}`}
            d={pathD(pts, b.shape === "smooth")}
            pathLength={1}
            className="vz-sc-path"
            data-tone={b.tone}
            style={{ strokeDashoffset: 1 - progress(tau, b.t, 0.24) }}
          />
        );
      })}

      {scene.actors.map((a) => {
        const p = pos.get(a.id)!;
        const mark = marks.get(a.id);
        const fill = fills.get(a.id);
        const talking = line?.beat.actor === a.id;
        return (
          <g
            key={a.id}
            className="vz-sc-actor"
            data-dim={dim.has(a.id) ? "" : undefined}
            data-talking={talking ? "" : undefined}
            transform={`translate(${p.x} ${p.y})`}
          >
            {/* Fundo da cor do quadro atrás do ícone: o traço passa por baixo da peça */}
            <rect
              x={-16}
              y={-24}
              width={32}
              height={31}
              className="vz-sc-label-plate"
            />
            <g
              transform="translate(-14 -22) scale(1.16)"
              className="vz-sc-icon"
            >
              {sceneIcon(a.icon)}
            </g>
            {/* Fundo da cor do quadro: um traço que passe por baixo não apaga o nome */}
            <rect
              x={-(a.label.length * 3.2 + 4)}
              y={5}
              width={a.label.length * 6.4 + 8}
              height={16}
              className="vz-sc-label-plate"
            />
            <text y={17} textAnchor="middle" className="vz-sc-label">
              {a.label}
            </text>
            {fill && (
              <g
                className="vz-sc-fill"
                data-tone={fill.beat.tone}
                transform="translate(-28 24)"
              >
                <rect
                  x={-3}
                  y={-2}
                  width={62}
                  height={24}
                  className="vz-sc-label-plate"
                />
                <rect width={56} height={6} className="vz-sc-fill-track" />
                <rect
                  width={56 * fill.beat.amount * fill.p}
                  height={6}
                  className="vz-sc-fill-bar"
                />
                <text
                  x={28}
                  y={18}
                  textAnchor="middle"
                  className="vz-sc-fill-label"
                >
                  {fill.beat.text}
                </text>
              </g>
            )}
            {mark && mark.beat.mark && (
              <g
                className="vz-sc-mark"
                data-mark={mark.beat.mark}
                transform={`translate(15 -20) scale(${0.6 + 0.4 * mark.p})`}
                opacity={mark.p}
              >
                <circle r={7.5} />
                <g transform="translate(-5 -5) scale(0.42)">
                  {sceneIcon(MARK_ICON[mark.beat.mark])}
                </g>
              </g>
            )}
          </g>
        );
      })}

      {line && caption && (
        <g className="vz-sc-say" data-tone={line.beat.tone} opacity={line.p}>
          <rect x={capX} y={4} width={capW} height={18} />
          <text x={capX + capW / 2} y={16.5} textAnchor="middle">
            {caption}
          </text>
        </g>
      )}
    </>
  );
}

export function PaperScene({ scene }: { scene: Scene }) {
  const layout = useMemo(() => layoutScene(scene), [scene]);
  const [tau, setTau] = useState(1);
  const [run, setRun] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  // Toca uma vez quando a cena aparece; "Play again" toca outra
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true;
          setRun((r) => r + 1);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (run === 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = clamp((now - start) / DURATION);
      setTau(p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    setTau(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  const panels: [string, ScenePanel][] = [
    ["Before", scene.before],
    ["With this paper", scene.after],
  ];

  return (
    <div className="vz-sc" ref={root}>
      <div className="vz-sc-panels">
        {panels.map(([side, panel], i) => (
          <figure
            key={side}
            className="vz-sc-panel"
            data-side={i ? "after" : "before"}
          >
            <figcaption className="vz-sc-head">
              <span className="vz-sc-side">{side}</span>
              <span className="vz-sc-name">{panel.label}</span>
            </figcaption>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="vz-sc-stage"
              role="img"
              aria-label={`${side}: ${panel.outcome}`}
            >
              <Ground setting={scene.setting} />
              <Frame scene={scene} panel={panel} layout={layout} tau={tau} />
            </svg>
            <p
              className="vz-sc-outcome"
              data-shown={tau >= 0.9 ? "" : undefined}
            >
              {panel.outcome}
            </p>
          </figure>
        ))}
      </div>
      <button
        type="button"
        className="op-link vz-sc-replay"
        onClick={() => setRun((r) => r + 1)}
      >
        Play again <Icon name="arrow-right" />
      </button>
    </div>
  );
}
