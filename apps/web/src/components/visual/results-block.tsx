"use client";

import { useState } from "react";

import type { Predict, Results } from "@/lib/visual-types";

/*
  Primeiro o palpite, depois o gráfico. Quem chuta antes lembra mais do
  resultado; quem não quer chutar abre direto. O número principal já está
  no topo da página, então esconder o gráfico não esconde a conclusão.
*/

function fmt(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return String(Math.round(v * 100) / 100);
}

function Chart({ results }: { results: Results }) {
  const rows = [...results.rows].sort((a, b) =>
    results.higher_is_better ? b.value - a.value : a.value - b.value,
  );
  const lo = Math.min(0, ...rows.map((r) => r.value));
  const hi = Math.max(...rows.map((r) => r.value));
  const span = hi - lo || 1;

  return (
    <figure className="vz-results m-0" data-reveal="fade" data-delay="0">
      <figcaption className="vz-chart-title">{results.caption}</figcaption>
      <p className="vz-chart-sub">
        {results.metric}
        {results.unit && results.unit !== "%" ? ` (${results.unit})` : ""} ·{" "}
        {results.higher_is_better ? "higher is better" : "lower is better"}
      </p>
      <ol className="vz-bars">
        {rows.map((r, i) => (
          <li key={`${r.label}-${i}`} className="vz-bar-row" data-ours={r.ours ? "" : undefined}>
            <span className="vz-bar-label">{r.label}</span>
            <span className="vz-bar-track">
              <span
                className="vz-bar-fill"
                style={{
                  width: `${((r.value - lo) / span) * 100}%`,
                  transitionDelay: `${i * 70}ms`,
                }}
              />
            </span>
            <span className="vz-bar-value tnum">
              {fmt(r.value)}
              {results.unit === "%" ? "%" : ""}
            </span>
          </li>
        ))}
      </ol>
      <details className="vz-source">
        <summary>From the paper</summary>
        <blockquote>“{results.source_quote}”</blockquote>
      </details>
    </figure>
  );
}

export function ResultsBlock({
  results,
  predict,
}: {
  results: Results | null;
  predict: Predict | null;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const answered = picked !== null;
  const open = !predict || answered || skipped || !results;

  return (
    <div className="vz-results-wrap">
      {predict && (
        <div className="vz-predict" data-reveal="fade" data-delay="40">
          <p className="vz-predict-q">{predict.question}</p>
          <div className="vz-options" role="group" aria-label="Your guess">
            {predict.options.map((opt, i) => {
              const state = !answered
                ? undefined
                : i === predict.answer
                  ? "right"
                  : i === picked
                    ? "wrong"
                    : "idle";
              return (
                <button
                  key={i}
                  type="button"
                  className="vz-option"
                  data-state={state}
                  disabled={answered}
                  onClick={() => setPicked(i)}
                  data-cur="pick"
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {answered ? (
            <p className="vz-reveal" aria-live="polite">
              <span className="vz-verdict">{picked === predict.answer ? "Right." : "Not quite."}</span>{" "}
              {predict.reveal}
            </p>
          ) : (
            results && (
              <button type="button" className="op-link vz-skip" onClick={() => setSkipped(true)}>
                Just show me
              </button>
            )
          )}
        </div>
      )}

      {results && open && <Chart results={results} />}
    </div>
  );
}
