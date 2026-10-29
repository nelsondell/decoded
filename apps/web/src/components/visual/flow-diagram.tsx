import type { Flow, FlowNode } from "@/lib/visual-types";

/*
  O método como diagrama. Camadas pelo caminho mais longo: cada nó fica uma
  coluna à frente do que o alimenta. Arestas que voltam (um laço de treino,
  um refinamento) descem por baixo das caixas. Duas orientações — deitada
  no desktop, em pé no celular — escolhidas por CSS.
*/

type Placed = FlowNode & { layer: number; row: number; rows: number };

function place(flow: Flow): { nodes: Placed[]; layers: number } {
  const order = new Map(flow.nodes.map((n, i) => [n.id, i]));
  const layer = new Map<string, number>();
  for (const n of flow.nodes) {
    const ins = flow.edges.filter(
      (e) => e.target === n.id && (order.get(e.source) ?? 0) < (order.get(n.id) ?? 0),
    );
    layer.set(n.id, ins.length ? Math.max(...ins.map((e) => (layer.get(e.source) ?? 0) + 1)) : 0);
  }
  const layers = Math.max(...layer.values()) + 1;
  const counts = new Array(layers).fill(0);
  const placed = flow.nodes.map((n) => {
    const l = layer.get(n.id) ?? 0;
    return { ...n, layer: l, row: counts[l]++, rows: 0 };
  });
  for (const p of placed) p.rows = counts[p.layer];
  return { nodes: placed, layers };
}

/** Rótulo em até duas linhas equilibradas. */
function lines(label: string): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length < 2 || label.length <= 12) return [label];
  let best = 1;
  let diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    if (Math.abs(a - b) < diff) {
      diff = Math.abs(a - b);
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

type Geometry = {
  width: number;
  height: number;
  box: { w: number; h: number };
  center: (p: Placed) => { x: number; y: number };
  vertical: boolean;
  /** Onde corre o primeiro laço: abaixo de todas as caixas (deitado) ou à direita (em pé). */
  lane: number;
  /** Meio vão entre colunas, por onde os laços saem e entram. */
  gap: number;
};

const LANE_STEP = 12;

function geometry(
  layers: number,
  maxRows: number,
  vertical: boolean,
  labelled: boolean,
  loops: number,
): Geometry {
  if (vertical) {
    const box = { w: 180, h: 46 };
    const step = 86;
    const spread = maxRows * (box.w + 24) - 24;
    const right = loops ? 22 + loops * LANE_STEP + 40 : 0;
    const width = Math.max(320, spread + 40 + right * 2);
    return {
      width,
      height: layers * step + 20,
      box,
      vertical,
      lane: width / 2 + spread / 2 + 22,
      gap: (step - box.h) / 2,
      center: (p) => ({
        x: width / 2 + (p.row - (p.rows - 1) / 2) * (box.w + 24),
        y: 10 + step / 2 + p.layer * step,
      }),
    };
  }
  const width = 640;
  const colW = width / layers;
  const box = { w: Math.min(124, colW - 28), h: 52 };
  const rowH = 74;
  // Rótulos de aresta moram acima das caixas; laços, numa faixa abaixo de todas
  const top = labelled ? 26 : 4;
  const nodesBottom = top + Math.max(1, maxRows) * rowH - (rowH - box.h);
  const bottom = loops ? 18 + loops * LANE_STEP + 16 : 4;
  return {
    width,
    height: nodesBottom + bottom,
    box,
    vertical,
    lane: nodesBottom + 18,
    gap: (colW - box.w) / 2,
    center: (p) => ({
      x: colW * p.layer + colW / 2,
      y: top + box.h / 2 + (maxRows - p.rows) * (rowH / 2) + p.row * rowH,
    }),
  };
}

type Routed = { d: string; label: { x: number; y: number; anchor: "start" | "middle" } };

/** Aresta para a frente: curva da saída de uma caixa à entrada da próxima. */
function forward(g: Geometry, a: Placed, b: Placed): Routed {
  const s = g.center(a);
  const t = g.center(b);
  const { w, h } = g.box;
  if (g.vertical) {
    const y0 = s.y + h / 2;
    const y1 = t.y - h / 2 - 4;
    const m = (y0 + y1) / 2;
    return {
      d: `M${s.x},${y0} C${s.x},${m} ${t.x},${m} ${t.x},${y1}`,
      label: { x: (s.x + t.x) / 2 + 10, y: m + 4, anchor: "start" },
    };
  }
  const x0 = s.x + w / 2;
  const x1 = t.x - w / 2 - 4;
  const m = (x0 + x1) / 2;
  return {
    d: `M${x0},${s.y} C${m},${s.y} ${m},${t.y} ${x1},${t.y}`,
    label: { x: m, y: Math.min(s.y, t.y) - h / 2 - 9, anchor: "middle" },
  };
}

/**
 * Laço (volta a uma caixa anterior): desce para a faixa própria e corre
 * por ela, sem atravessar caixas. Sai e entra por baixo quando a caixa é
 * a última da coluna; senão, pelo vão ao lado.
 */
function loop(g: Geometry, a: Placed, b: Placed, k: number): Routed {
  const s = g.center(a);
  const t = g.center(b);
  const { w, h } = g.box;
  const lane = g.lane + k * LANE_STEP;
  if (g.vertical) {
    const x0 = s.x + w / 2;
    const x1 = t.x + w / 2 + 4;
    return {
      d: `M${x0},${s.y} H${lane} V${t.y} H${x1}`,
      label: { x: lane + 6, y: (s.y + t.y) / 2 + 4, anchor: "start" },
    };
  }
  const nudge = k * 3;
  const out =
    a.row === a.rows - 1
      ? `M${s.x},${s.y + h / 2} V${lane}`
      : `M${s.x - w / 2},${s.y} H${s.x - w / 2 - g.gap + nudge} V${lane}`;
  const into =
    b.row === b.rows - 1
      ? `H${t.x} V${t.y + h / 2 + 4}`
      : `H${t.x + w / 2 + g.gap - nudge} V${t.y} H${t.x + w / 2 + 4}`;
  const from = a.row === a.rows - 1 ? s.x : s.x - w / 2 - g.gap + nudge;
  const to = b.row === b.rows - 1 ? t.x : t.x + w / 2 + g.gap - nudge;
  return {
    d: `${out} ${into}`,
    label: { x: (from + to) / 2, y: lane + 12, anchor: "middle" },
  };
}

function Diagram({ flow, vertical }: { flow: Flow; vertical: boolean }) {
  const { nodes, layers } = place(flow);
  const maxRows = Math.max(...nodes.map((n) => n.rows));
  const order = new Map(flow.nodes.map((n, i) => [n.id, i]));
  const isBack = (e: Flow["edges"][number]) => (order.get(e.source) ?? 0) > (order.get(e.target) ?? 0);
  const loops = flow.edges.filter(isBack);
  const g = geometry(
    layers,
    maxRows,
    vertical,
    flow.edges.some((e) => e.label && !isBack(e)),
    loops.length,
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const arrow = vertical ? "vz-arrow-v" : "vz-arrow-h";

  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      className={vertical ? "vz-flow-svg vz-only-narrow" : "vz-flow-svg vz-only-wide"}
      role="img"
      aria-label={`Method: ${flow.nodes.map((n) => n.label).join(", then ")}`}
    >
      <defs>
        <marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0.5 L7.5,4 L0,7.5" fill="none" stroke="var(--ink-3)" strokeWidth="1" />
        </marker>
      </defs>

      {flow.edges.map((e, i) => {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) return null;
        const back = isBack(e);
        const { d, label: at } = back ? loop(g, a, b, loops.indexOf(e)) : forward(g, a, b);
        return (
          <g key={i} className="vz-edge" style={{ "--i": a.layer } as React.CSSProperties}>
            <path
              d={d}
              pathLength={1}
              data-draw=""
              fill="none"
              stroke="var(--ink-3)"
              strokeWidth={1}
              strokeDasharray={back ? "3 3" : undefined}
              markerEnd={`url(#${arrow})`}
            />
            {e.label && (
              <text x={at.x} y={at.y} textAnchor={at.anchor} className="vz-edge-label">
                {e.label}
              </text>
            )}
          </g>
        );
      })}

      {nodes.map((n) => {
        const c = g.center(n);
        const ls = lines(n.label);
        return (
          <g
            key={n.id}
            className="vz-node"
            data-kind={n.kind}
            style={{ "--i": n.layer } as React.CSSProperties}
          >
            <rect x={c.x - g.box.w / 2} y={c.y - g.box.h / 2} width={g.box.w} height={g.box.h} />
            {ls.map((line, i) => (
              <text
                key={i}
                x={c.x}
                y={c.y + (i - (ls.length - 1) / 2) * 15 + 4.5}
                textAnchor="middle"
                className="vz-node-label"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function FlowDiagram({ flow }: { flow: Flow }) {
  return (
    <figure className="vz-flow m-0" data-reveal="fade" data-delay="80">
      <Diagram flow={flow} vertical={false} />
      <Diagram flow={flow} vertical />
    </figure>
  );
}
