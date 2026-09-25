"use client";

import { useEffect, useRef, useState } from "react";
import type { DiagramMode } from "@/lib/mode-types";

let mermaidInitialized = false;

export function DiagramModeView({ data }: { data: DiagramMode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;

      if (!mermaidInitialized) {
        // A paleta do Offprint, clara ou escura conforme o sistema. O
        // Mermaid não lê variáveis CSS, então os valores vão em hex.
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          themeVariables: {
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "14px",
            primaryColor: dark ? "#1A1E17" : "#EBE8DF",
            primaryTextColor: dark ? "#E6E2D7" : "#171A16",
            primaryBorderColor: dark ? "#2B3027" : "#DCD8CB",
            lineColor: dark ? "#8CBE73" : "#3D5233",
            secondaryColor: dark ? "#1F2A1B" : "#E6E8DF",
            tertiaryColor: dark ? "#131610" : "#F4F2EC",
          },
        });
        mermaidInitialized = true;
      }

      try {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, data.mermaid);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render");
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [data.mermaid]);

  return (
    <div className="flex flex-col gap-[calc(32*var(--px))]">
      <p className="op-prose op-prose-2 m-0">{data.caption}</p>

      <figure className="m-0">
        <div ref={containerRef} className="op-inset overflow-x-auto p-[calc(28*var(--px))]">
          {svg && (
            <div
              className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}

          {error && (
            <div>
              <p className="op-label m-0 text-destructive">Diagram failed to render</p>
              <pre className="mt-3 overflow-x-auto font-mono text-[length:calc(13*var(--px))] font-light leading-[1.7] text-muted-foreground">
                {data.mermaid}
              </pre>
            </div>
          )}

          {!svg && !error && <div className="h-48 animate-pulse bg-border/60" />}
        </div>
        <figcaption className="op-figcaption">
          <span>fig. {data.diagram_type}</span>
          <span>{data.walkthrough.length} steps</span>
        </figcaption>
      </figure>

      {data.walkthrough.length > 0 && (
        <ol className="m-0 flex list-none flex-col p-0">
          {data.walkthrough.map((step, i) => (
            <li
              key={i}
              className="grid gap-2 border-t border-border py-[calc(14*var(--px))] first:border-t-0 sm:grid-cols-[calc(48*var(--px))_1fr]"
            >
              <span className="op-label tnum pt-[0.45em]">{String(i + 1).padStart(2, "0")}</span>
              <span className="op-prose">{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
