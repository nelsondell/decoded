"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import type { Scene, SceneActor, SceneBeat } from "@/lib/visual-types";

import { sceneIcon } from "./scene-icons";

/*
  A cena antes × depois num quadro só. As abas trocam o lado, e a troca não
  corta: as peças andam até onde ficam do outro lado, os medidores sobem ou
  descem, os traços de um lado somem e os do outro se desenham. O que fica
  parado é o que o paper não muda; o olho vai direto no que muda.

  Ao entrar em tela, toca a história do "antes" desde o começo, segura um
  instante e passa para o "depois". Sem animação (reduced motion), as abas
  trocam na hora.

  Nada se sobrepõe, por construção:
  - as falas e o veredito ficam fora do desenho, como legenda;
  - cada peça ocupa um retângulo (ficha, selo, nome e medidor); se cair em
    cima de outra peça ou de um traço, vai para a vaga livre mais próxima;
  - traços que nascem numa peça começam na borda dela, sem riscar o nome.
*/

const W = 360;
const H = 204;
const TOP = 6;
const COLS = 24;
const ROWS = 12;
const CW = W / COLS;
const CH = (H - TOP * 2) / ROWS;
/** Raio da ficha de cada peça e lado do ícone dentro dela. */
const R = 16;
const ICON = 20;
const PAD = 4;
const STORY = 3800;
const HOLD = 1600;
const MORPH = 900;

type Pt = { x: number; y: number };
type Box = { x0: number; y0: number; x1: number; y1: number };
type Line = { samples: Pt[]; ends: Pt[] };
type Side = "before" | "after";
type Tone = SceneBeat["tone"];
type MarkName = Exclude<SceneBeat["mark"], "">;

/** O que está na tela num instante: um ponto da história de um lado, ou a passagem de um lado ao outro. */
type Shown = {
  pos: Map<string, Pt>;
  dim: Map<string, number>;
  fills: Map<string, { amount: number; tone: Tone; text: string; alpha: number }>;
  marks: { key: string; actor: string; mark: MarkName; alpha: number }[];
  traces: {
    key: string;
    pts: Pt[];
    smooth: boolean;
    tone: Tone;
    draw: number;
    alpha: number;
  }[];
  line: { actor: string; text: string } | null;
};

/** Sem "from", a história do lado no ponto p; com "from", a passagem dele até o fim do lado. */
type Clip = { side: Side; from: Shown | null; p: number };
type Step =
  | { kind: "story"; side: Side; ms: number }
  | { kind: "morph"; side: Side; ms: number }
  | { kind: "hold"; ms: number };

const SIDES: [Side, string][] = [
  ["before", "Before"],
  ["after", "With this paper"],
];

const at = (col: number, row: number): Pt => ({
  x: col * CW + CW / 2,
  y: TOP + row * CH + CH / 2,
});
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Quanto de um momento já aconteceu; chega a 1 no fim, mesmo que ele comece tarde. */
const grow = (tau: number, t: number, span: number) =>
  clamp((tau - t) / Math.max(0.02, Math.min(span, 1 - t)));

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
const contains = (b: Box, p: Pt) =>
  p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1;

/** Retângulo de uma peça: ficha e selo em cima, nome e medidor embaixo. */
function footprint(actor: SceneActor, p: Pt, metered: boolean): Box {
  const half = Math.max(actor.label.length * 3.3 + 5, metered ? 32 : R + 6);
  return {
    x0: p.x - half,
    y0: p.y - R - 6,
    x1: p.x + half,
    y1: p.y + (metered ? R + 42 : R + 19),
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

/** Vagas candidatas a cada meia célula, inclusive abaixo do quadro. */
const SPOTS: Pt[] = Array.from({ length: COLS * 2 - 1 }, (_, i) =>
  Array.from({ length: ROWS * 3 }, (_, j) => ({
    x: CW / 2 + (i * CW) / 2,
    y: TOP + CH / 2 + (j * CH) / 2,
  })),
).flat();

/**
 * A vaga livre mais perto do ponto pedido, sem encostar em outra peça.
 * Primeiro dentro do quadro e sem traço atravessando; depois aceitando
 * traço por baixo (as peças têm fundo, o traço some sob elas); por último
 * abaixo do quadro, que cresce para caber. Peça sobre peça, nunca.
 */
function settle(
  want: Pt,
  box: (p: Pt) => Box,
  taken: Box[],
  lines: Line[],
): Pt {
  const fits = (p: Pt, bottom: number) => {
    const b = box(p);
    return (
      b.x0 >= 2 &&
      b.y0 >= 2 &&
      b.x1 <= W - 2 &&
      b.y1 <= bottom &&
      !taken.some((t) => hits(b, t))
    );
  };
  const order = [
    want,
    ...[...SPOTS].sort(
      (a, b) =>
        Math.hypot(a.x - want.x, a.y - want.y) -
        Math.hypot(b.x - want.x, b.y - want.y),
    ),
  ];
  return (
    order.find((p) => fits(p, H - 2) && !crosses(box(p), p, lines)) ??
    order.find((p) => fits(p, H - 2)) ??
    order.find((p) => fits(p, Infinity)) ??
    want
  );
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
  targets: Record<Side, Map<number, Pt>>;
  paths: Record<Side, Map<number, Pt[]>>;
  metered: Set<string>;
  view: string;
};

/**
 * O recorte do desenho: só a área que a cena usa, com folga, para as peças
 * ficarem grandes. Nunca menor que dois terços do quadro e entre 2:1 e 4:3.
 */
function fit(boxes: Box[]): string {
  let x0 = Math.min(...boxes.map((b) => b.x0)) - 10;
  let x1 = Math.max(...boxes.map((b) => b.x1)) + 10;
  let y0 = Math.min(...boxes.map((b) => b.y0)) - 10;
  let y1 = Math.max(...boxes.map((b) => b.y1)) + 10;
  if (x1 - x0 < W * 0.66) {
    const c = (x0 + x1) / 2;
    x0 = c - W * 0.33;
    x1 = c + W * 0.33;
  }
  const w = x1 - x0;
  if (y1 - y0 < w * 0.5) {
    const c = (y0 + y1) / 2;
    y0 = c - w * 0.25;
    y1 = c + w * 0.25;
  } else if (y1 - y0 > w * 0.75) {
    const c = (x0 + x1) / 2;
    const half = (y1 - y0) / 0.75 / 2;
    x0 = c - half;
    x1 = c + half;
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  return `${r(x0)} ${r(y0)} ${r(x1 - x0)} ${r(y1 - y0)}`;
}

function layoutScene(scene: Scene): Layout {
  const sides: Side[] = ["before", "after"];
  const metered = new Set(
    sides.flatMap((s) =>
      scene[s].beats.filter((b) => b.kind === "fill").map((b) => b.actor),
    ),
  );
  const lines: Line[] = sides.flatMap((s) =>
    scene[s].beats
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
  const used: Box[] = [...taken];
  const targets = {} as Layout["targets"];
  const paths = {} as Layout["paths"];
  for (const side of sides) {
    const now = new Map(start);
    const moved = new Map<number, Pt>();
    const drawn = new Map<number, Pt[]>();
    scene[side].beats.forEach((b, i) => {
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
        used.push(
          ...pts.map((p) => ({ x0: p.x - 4, y0: p.y - 4, x1: p.x + 4, y1: p.y + 4 })),
        );
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
      used.push(footprint(actor, p, metered.has(actor.id)));
    });
    targets[side] = moved;
    paths[side] = drawn;
  }
  return { start, targets, paths, metered, view: fit(used) };
}

/** A história de um lado no instante tau (0 a 1), a partir das posições iniciais. */
function stateAt(scene: Scene, layout: Layout, side: Side, tau: number): Shown {
  const pos = new Map(layout.start);
  const dim = new Map<string, number>();
  const fills: Shown["fills"] = new Map();
  const marks = new Map<string, Shown["marks"][number]>();
  const traces: Shown["traces"] = [];
  let line: Shown["line"] = null;

  scene[side].beats.forEach((b, i) => {
    if (tau < b.t) return;
    if (b.kind === "move") {
      const from = pos.get(b.actor);
      const to = layout.targets[side].get(i);
      if (!from || !to) return;
      const p = ease(grow(tau, b.t, 0.14));
      pos.set(b.actor, { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) });
    } else if (b.kind === "dim") {
      dim.set(b.actor, grow(tau, b.t, 0.08));
    } else if (b.kind === "mark" && b.mark) {
      marks.set(b.actor, {
        key: `${side}${i}`,
        actor: b.actor,
        mark: b.mark,
        alpha: grow(tau, b.t, 0.06),
      });
    } else if (b.kind === "fill") {
      fills.set(b.actor, {
        amount: b.amount * ease(grow(tau, b.t, 0.3)),
        tone: b.tone,
        text: b.text,
        alpha: 1,
      });
    } else if (b.kind === "path") {
      const pts = layout.paths[side].get(i);
      if (pts)
        traces.push({
          key: `${side}${i}`,
          pts,
          smooth: b.shape === "smooth",
          tone: b.tone,
          draw: grow(tau, b.t, 0.24),
          alpha: 1,
        });
    } else if (b.kind === "say") {
      line = { actor: b.actor, text: b.text };
    }
  });
  return { pos, dim, fills, marks: [...marks.values()], traces, line };
}

/** A passagem de um estado a outro: anda, cresce, some de um lado e aparece do outro. */
function mix(a: Shown, b: Shown, p: number): Shown {
  const e = ease(p);
  const pos = new Map<string, Pt>();
  for (const [id, to] of b.pos) {
    const from = a.pos.get(id) ?? to;
    pos.set(id, { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) });
  }
  const dim = new Map<string, number>();
  for (const id of new Set([...a.dim.keys(), ...b.dim.keys()]))
    dim.set(id, lerp(a.dim.get(id) ?? 0, b.dim.get(id) ?? 0, e));
  const fills: Shown["fills"] = new Map();
  for (const id of new Set([...a.fills.keys(), ...b.fills.keys()])) {
    const fa = a.fills.get(id);
    const fb = b.fills.get(id);
    const top = (e < 0.5 ? (fa ?? fb) : (fb ?? fa))!;
    fills.set(id, {
      amount: lerp(fa?.amount ?? 0, fb?.amount ?? 0, e),
      tone: top.tone,
      text: top.text,
      alpha: lerp(fa?.alpha ?? 0, fb?.alpha ?? 0, e),
    });
  }
  // Selo igual dos dois lados fica onde está; o resto troca
  const same = (m: Shown["marks"][number], list: Shown["marks"]) =>
    list.some((o) => o.actor === m.actor && o.mark === m.mark);
  const marks = [
    ...a.marks.map((m) =>
      same(m, b.marks) ? m : { ...m, key: `a${m.key}`, alpha: m.alpha * (1 - e) },
    ),
    ...b.marks
      .filter((m) => !same(m, a.marks))
      .map((m) => ({ ...m, key: `b${m.key}`, alpha: m.alpha * e })),
  ].filter((m) => m.alpha > 0.01);
  const traces = [
    ...a.traces.map((t) => ({ ...t, key: `a${t.key}`, alpha: t.alpha * (1 - e) })),
    ...b.traces.map((t) => ({ ...t, key: `b${t.key}`, draw: t.draw * e })),
  ].filter((t) => t.alpha > 0.01);
  return { pos, dim, fills, marks, traces, line: e < 0.5 ? a.line : b.line };
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
    const top = TOP + CH * 4;
    const bottom = TOP + CH * 8;
    return (
      <g className="vz-sc-ground">
        <rect
          x={-W}
          y={top}
          width={W * 3}
          height={bottom - top}
          className="vz-sc-road"
        />
        <path d={`M${-W} ${top}H${W * 2}M${-W} ${bottom}H${W * 2}`} />
        <path d={`M${-W} ${(top + bottom) / 2}H${W * 2}`} className="vz-sc-lane" />
      </g>
    );
  }
  if (setting === "desk") {
    return (
      <g className="vz-sc-ground">
        <path d={`M8 ${H - 4}H${W - 8}`} />
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

function Stage({
  scene,
  shown,
  uid,
}: {
  scene: Scene;
  shown: Shown;
  uid: string;
}) {
  return (
    <>
      <Ground setting={scene.setting} />
      {shown.traces.map((t) => (
        <path
          key={t.key}
          d={pathD(t.pts, t.smooth)}
          pathLength={1}
          className="vz-sc-path"
          data-tone={t.tone}
          opacity={t.alpha}
          style={{ strokeDashoffset: 1 - t.draw }}
          markerEnd={t.draw > 0.97 ? `url(#${uid}-${t.tone})` : undefined}
        />
      ))}

      {scene.actors.map((a) => {
        const p = shown.pos.get(a.id)!;
        const fill = shown.fills.get(a.id);
        const marks = shown.marks.filter((m) => m.actor === a.id);
        const ring = marks.reduce<(typeof marks)[number] | null>(
          (best, m) => (!best || m.alpha > best.alpha ? m : best),
          null,
        );
        const half = a.label.length * 3.2 + 4;
        return (
          <g
            key={a.id}
            className="vz-sc-actor"
            data-talking={shown.line?.actor === a.id ? "" : undefined}
            transform={`translate(${p.x} ${p.y})`}
            opacity={1 - 0.72 * (shown.dim.get(a.id) ?? 0)}
          >
            {/* Fundo do nome, colado na ficha: o traço que passa por baixo não risca nada */}
            <rect
              x={-half}
              y={R - 2}
              width={half * 2}
              height={20}
              className="vz-sc-label-plate"
            />
            {/* A ficha tem fundo: o traço que passa por baixo some atrás dela */}
            <circle
              r={R}
              className="vz-sc-token"
              data-mark={ring && ring.alpha > 0.5 ? ring.mark : undefined}
            />
            <g
              transform={`translate(${-ICON / 2} ${-ICON / 2}) scale(${ICON / 24})`}
              className="vz-sc-icon"
            >
              {sceneIcon(a.icon)}
            </g>
            <text y={R + 13} textAnchor="middle" className="vz-sc-label">
              {a.label}
            </text>
            {fill && fill.alpha > 0.01 && (
              <g
                className="vz-sc-fill"
                data-tone={fill.tone}
                transform={`translate(-28 ${R + 22})`}
                opacity={fill.alpha}
              >
                <rect
                  x={-3}
                  y={-3}
                  width={62}
                  height={23}
                  className="vz-sc-label-plate"
                />
                <rect width={56} height={6} className="vz-sc-fill-track" />
                <rect
                  width={56 * clamp(fill.amount)}
                  height={6}
                  className="vz-sc-fill-bar"
                />
                <text
                  x={28}
                  y={16}
                  textAnchor="middle"
                  className="vz-sc-fill-label"
                >
                  {fill.text}
                </text>
              </g>
            )}
            {marks.map((m) => (
              <g
                key={m.key}
                className="vz-sc-mark"
                data-mark={m.mark}
                transform={`translate(${R - 3} ${-R + 3}) scale(${0.6 + 0.4 * m.alpha})`}
                opacity={m.alpha}
              >
                <circle r={7.5} />
                <g transform="translate(-5 -5) scale(0.42)">
                  {sceneIcon(MARK_ICON[m.mark])}
                </g>
              </g>
            ))}
          </g>
        );
      })}
    </>
  );
}

export function PaperScene({ scene }: { scene: Scene }) {
  const layout = useMemo(() => layoutScene(scene), [scene]);
  const ends = useMemo(
    () => ({
      before: stateAt(scene, layout, "before", 1),
      after: stateAt(scene, layout, "after", 1),
    }),
    [scene, layout],
  );
  const resolve = useCallback(
    (c: Clip) =>
      c.from
        ? mix(c.from, ends[c.side], c.p)
        : stateAt(scene, layout, c.side, c.p),
    [scene, layout, ends],
  );

  // Antes de rodar, o fim do "antes": é o que sai no HTML e o que fica sem animação
  const [clip, setClip] = useState<Clip>({ side: "before", from: null, p: 1 });
  const current = useRef(clip);
  const frame = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const show = useCallback((c: Clip) => {
    current.current = c;
    setClip(c);
  }, []);

  const play = useCallback(
    (steps: Step[]) => {
      cancelAnimationFrame(frame.current);
      let i = 0;
      let t0 = performance.now();
      let from: Shown | null = null;
      const begin = () => {
        const s = steps[i];
        if (s.kind === "morph") from = resolve(current.current);
        t0 = performance.now();
      };
      const tick = (now: number) => {
        const s = steps[i];
        const p = clamp((now - t0) / s.ms);
        if (s.kind === "story") show({ side: s.side, from: null, p });
        else if (s.kind === "morph") show({ side: s.side, from, p });
        if (p >= 1) {
          i += 1;
          if (i >= steps.length) return;
          begin();
        }
        frame.current = requestAnimationFrame(tick);
      };
      begin();
      frame.current = requestAnimationFrame(tick);
    },
    [resolve, show],
  );

  const still = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sequence = useCallback(
    () =>
      play([
        { kind: "story", side: "before", ms: STORY },
        { kind: "hold", ms: HOLD },
        { kind: "morph", side: "after", ms: MORPH },
      ]),
    [play],
  );

  function select(side: Side) {
    if (still()) {
      cancelAnimationFrame(frame.current);
      show({ side, from: null, p: 1 });
    } else play([{ kind: "morph", side, ms: MORPH }]);
  }

  // Toca uma vez quando a cena aparece. Até lá, espera no começo da história
  useEffect(() => {
    const el = root.current;
    if (!el || still()) return;
    let played = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played) {
          played = true;
          sequence();
        }
      },
      { threshold: 0.4 },
    );
    show({ side: "before", from: null, p: 0 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [sequence, show]);

  const shown = resolve(clip);
  const panel = scene[clip.side];
  // A legenda e o veredito aparecem no fim da história, ou na troca de lado
  const settled = clip.from !== null || clip.p >= 0.85;
  const speech = [
    ...new Map(
      [...scene.before.beats, ...scene.after.beats]
        .filter((b) => b.kind === "say" && b.text)
        .map((b) => [`${b.actor}|${b.text}`, b]),
    ).values(),
  ];
  const label = new Map(scene.actors.map((a) => [a.id, a.label]));

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      select(clip.side === "before" ? "after" : "before");
    }
  }

  return (
    <div className="vz-sc" ref={root}>
      <div className="vz-sc-tabs" role="tablist" aria-label="Before and after" onKeyDown={onKey}>
        {SIDES.map(([side, name]) => (
          <button
            key={side}
            type="button"
            role="tab"
            id={`${uid}-tab-${side}`}
            aria-selected={clip.side === side}
            aria-controls={`${uid}-panel`}
            tabIndex={clip.side === side ? 0 : -1}
            className="vz-sc-tab"
            data-side={side}
            onClick={() => select(side)}
          >
            <span className="vz-sc-side">{name}</span>
            <span className="vz-sc-name">{scene[side].label}</span>
          </button>
        ))}
      </div>

      <figure
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${clip.side}`}
        className="vz-sc-panel"
        data-side={clip.side}
      >
        <svg
          viewBox={layout.view}
          className="vz-sc-stage"
          role="img"
          aria-label={`${panel.label}: ${panel.outcome}`}
        >
          <defs>
            {(["good", "bad", "neutral"] as const).map((tone) => (
              <marker
                key={tone}
                id={`${uid}-${tone}`}
                viewBox="0 0 8 8"
                refX="6"
                refY="4"
                markerWidth="4"
                markerHeight="4"
                orient="auto-start-reverse"
              >
                <path d="M1 1 7 4 1 7z" className="vz-sc-arrow" data-tone={tone} />
              </marker>
            ))}
          </defs>
          <Stage scene={scene} shown={shown} uid={uid} />
        </svg>

        {/* Todas as falas no mesmo lugar, uma visível: a altura não pula */}
        {speech.length > 0 && (
          <div className="vz-sc-lines">
            {speech.map((b) => (
              <p
                key={`${b.actor}|${b.text}`}
                className="vz-sc-line"
                data-on={
                  shown.line?.actor === b.actor && shown.line.text === b.text
                    ? ""
                    : undefined
                }
              >
                <span className="vz-sc-who">{label.get(b.actor)}</span>
                {`“${b.text}”`}
              </p>
            ))}
          </div>
        )}

        <div className="vz-sc-outcomes">
          {SIDES.map(([side]) => (
            <p
              key={side}
              className="vz-sc-outcome"
              data-side={side}
              data-on={clip.side === side && settled ? "" : undefined}
            >
              {scene[side].outcome}
            </p>
          ))}
        </div>
      </figure>

      <button type="button" className="op-link vz-sc-replay" onClick={sequence}>
        Play again <Icon name="arrow-right" />
      </button>
    </div>
  );
}
