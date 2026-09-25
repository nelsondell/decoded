import type {
  ColumnsFigure,
  CurveFigure,
  FigureSpec,
  RowsFigure,
} from "@/lib/offprint";

/**
 * A prancha de um offprint. Geometria do protótipo: viewBox 560×300, área
 * útil de x=40 a x=548, base em y=250, rótulos em mono 9px com espaçamento
 * 1.26. As barras e curvas começam recolhidas e se abrem quando a figura
 * ganha data-shown (ver offprint.css).
 */

const X0 = 40;
const X1 = 548;
const BASE = 250;

const r1 = (n: number) => Math.round(n * 10) / 10;

function Label({
  x,
  y,
  children,
  anchor,
  tone = "var(--ink-3)",
  size = 9,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  anchor?: "start" | "end";
  tone?: string;
  size?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      className="op-svg-label"
      fontSize={size}
      letterSpacing={size === 9 ? 1.26 : undefined}
      textAnchor={anchor}
      fill={tone}
    >
      {children}
    </text>
  );
}

function Axis({ y = true }: { y?: boolean }) {
  return (
    <>
      <line x1={X0} y1={BASE} x2={X1} y2={BASE} stroke="var(--v-200)" strokeWidth={1.25} />
      {y && <line x1={X0} y1={50} x2={X0} y2={BASE} stroke="var(--v-200)" strokeWidth={1.25} />}
    </>
  );
}

function Columns({ fig }: { fig: ColumnsFigure }) {
  const n = fig.bars.length;
  const width = Math.min(30, Math.max(6, Math.round(((X1 - X0) / n) * 0.54)));
  const step = n > 1 ? (X1 - X0 - width) / (n - 1) : 0;
  const hl = fig.bars.findIndex((b) => b.highlight);

  const geo = fig.bars.map((b, i) => {
    const h = Math.max(2, (190 * b.value) / fig.max);
    return { x: r1(X0 + i * step), y: r1(BASE - h), h: r1(h) };
  });

  return (
    <>
      <Axis />
      {fig.bars.map((b, i) => (
        <rect
          key={i}
          data-bar=""
          x={geo[i].x}
          y={geo[i].y}
          width={width}
          height={geo[i].h}
          fill={b.highlight ? "var(--moss)" : "var(--ink)"}
          style={{ transitionDelay: `${i * 60}ms` }}
        />
      ))}
      {/* Acima da área do gráfico: nunca cruza uma barra. O musgo liga o rótulo à barra. */}
      {hl >= 0 && (
        <Label x={X1} y={40} anchor="end" tone="var(--moss)">
          {fig.mark}
        </Label>
      )}
      <Label x={X0} y={272}>{fig.axis[0]}</Label>
      <Label x={X1} y={272} anchor="end">{fig.axis[1]}</Label>
      <Label x={34} y={64} anchor="end">{fig.yLabel}</Label>
    </>
  );
}

function Rows({ fig }: { fig: RowsFigure }) {
  // Duas linhas nas posições do protótipo; mais que isso, redistribui
  const slots =
    fig.rows.length === 2
      ? [86, 176]
      : fig.rows.map((_, i) => 60 + (i * 170) / Math.max(1, fig.rows.length - 1));

  return (
    <>
      {fig.rows.map((row, i) => {
        const w = r1(Math.max(2, ((X1 - X0) * row.value) / fig.max));
        const labelY = slots[i];
        return (
          <g key={row.label}>
            <Label x={X0} y={labelY}>{row.label}</Label>
            <rect
              data-barx=""
              x={X0}
              y={labelY + 12}
              width={w}
              height={34}
              fill={row.highlight ? "var(--moss)" : "var(--ink)"}
              style={{ transitionDelay: `${i * 60}ms` }}
            />
            <Label x={r1(X0 + w + 10)} y={labelY + 36} size={11}>
              {row.display}
            </Label>
          </g>
        );
      })}
      <Axis y={false} />
      <Label x={X0} y={272}>{fig.axis[0]}</Label>
      <Label x={X1} y={272} anchor="end">{fig.axis[1]}</Label>
    </>
  );
}

/**
 * Curva monótona por partes (Fritsch–Carlson): passa por todos os pontos
 * sem ultrapassar os extremos, então nunca fura a base nem o teto.
 */
function smoothPath(points: [number, number][]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0][0]} ${points[0][1]}`;

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    m.push((ys[i + 1] - ys[i]) / dx[i]);
  }

  const t = new Array<number>(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }

  let d = `M${r1(xs[0])} ${r1(ys[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${r1(xs[i] + h)} ${r1(ys[i] + t[i] * h)}, ${r1(xs[i + 1] - h)} ${r1(
      ys[i + 1] - t[i + 1] * h,
    )}, ${r1(xs[i + 1])} ${r1(ys[i + 1])}`;
  }
  return d;
}

function Curve({ fig }: { fig: CurveFigure }) {
  const LOW = 238;
  const HIGH = 60;
  const toPoints = (values: number[]): [number, number][] =>
    values.map((v, i) => [
      X0 + (i * (X1 - X0)) / Math.max(1, values.length - 1),
      LOW - v * (LOW - HIGH),
    ]);

  const primary = toPoints(fig.primary);
  const secondary = fig.secondary ? toPoints(fig.secondary) : null;
  const markerX = fig.marker ? r1(primary[fig.marker.at][0]) : null;
  const markerRight = markerX !== null && markerX > 400;
  const thresholdY = fig.threshold
    ? r1(LOW - fig.threshold.value * (LOW - HIGH))
    : null;
  const secondaryEnd = secondary ? secondary[secondary.length - 1] : null;

  return (
    <>
      <Axis />
      {thresholdY !== null && fig.threshold && (
        <>
          <line
            data-draw="rule"
            pathLength={1}
            x1={X0}
            y1={thresholdY}
            x2={X1}
            y2={thresholdY}
            stroke="var(--moss)"
            strokeWidth={1.25}
            style={{ transitionDelay: "640ms" }}
          />
          <Label x={X1} y={thresholdY - 10} anchor="end" tone="var(--moss)">
            {fig.threshold.label}
          </Label>
        </>
      )}
      {secondary && (
        <path
          data-draw=""
          pathLength={1}
          d={smoothPath(secondary)}
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth={1.25}
          style={{ transitionDelay: "0ms" }}
        />
      )}
      <path
        data-draw=""
        pathLength={1}
        d={smoothPath(primary)}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={1.25}
        style={{ transitionDelay: fig.threshold ? "80ms" : "120ms" }}
      />
      {markerX !== null && fig.marker && (
        <>
          <line
            data-draw="rule"
            pathLength={1}
            x1={markerX}
            y1={50}
            x2={markerX}
            y2={BASE}
            stroke="var(--moss)"
            strokeWidth={1.25}
            style={{ transitionDelay: "700ms" }}
          />
          <Label
            x={markerRight ? markerX + 4 : markerX - 4}
            y={40}
            anchor={markerRight ? "end" : "start"}
            tone="var(--moss)"
          >
            {fig.marker.label}
          </Label>
        </>
      )}
      {secondaryEnd && fig.secondaryLabel && (
        <Label x={X1} y={r1(secondaryEnd[1] - 10)} anchor="end">
          {fig.secondaryLabel}
        </Label>
      )}
      <Label x={X0} y={272}>{fig.axis[0]}</Label>
      <Label x={X1} y={272} anchor="end">{fig.axis[1]}</Label>
    </>
  );
}

export function Plate({
  figure,
  side,
}: {
  figure: FigureSpec;
  side: "left" | "right";
}) {
  return (
    <figure className="op-plate" data-side={side} data-reveal="plate" data-delay="0">
      <svg viewBox="0 0 560 300" role="img" aria-label={figure.label}>
        {figure.type === "columns" && <Columns fig={figure} />}
        {figure.type === "rows" && <Rows fig={figure} />}
        {figure.type === "curve" && <Curve fig={figure} />}
      </svg>
      <figcaption className="op-figcaption">
        <span>{figure.caption[0]}</span>
        <span>{figure.caption[1]}</span>
      </figcaption>
    </figure>
  );
}
