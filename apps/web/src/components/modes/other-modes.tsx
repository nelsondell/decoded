"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { WhereItBreaks } from "@/components/page-shell";
import type { AnalogyMode, CodeMode, StoryMode } from "@/lib/mode-types";

// O bloco de código vive na segunda superfície, como todo inset do sistema.
// O tema é montado com as variáveis da paleta, então segue o modo escuro.
const CODE_STYLE = {
  margin: 0,
  borderRadius: 0,
  padding: "calc(24 * var(--px)) calc(26 * var(--px))",
  fontSize: "calc(14 * var(--px))",
  lineHeight: 1.75,
  background: "transparent",
} as const;

const BASE = {
  color: "var(--ink)",
  fontFamily: "var(--font-data)",
  fontWeight: 300,
  direction: "ltr",
  textAlign: "left",
  whiteSpace: "pre",
  wordSpacing: "normal",
  wordBreak: "normal",
  tabSize: 4,
  hyphens: "none",
} as const;

const OFFPRINT_CODE: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': BASE,
  'pre[class*="language-"]': { ...BASE, overflow: "auto" },
  comment: { color: "var(--ink-3)", fontStyle: "italic" },
  prolog: { color: "var(--ink-3)" },
  doctype: { color: "var(--ink-3)" },
  cdata: { color: "var(--ink-3)" },
  punctuation: { color: "var(--ink-2)" },
  operator: { color: "var(--ink-2)" },
  keyword: { color: "var(--moss)" },
  builtin: { color: "var(--moss)" },
  boolean: { color: "var(--moss)" },
  number: { color: "var(--moss)" },
  constant: { color: "var(--moss)" },
  string: { color: "var(--ink-2)" },
  char: { color: "var(--ink-2)" },
  "attr-value": { color: "var(--ink-2)" },
  function: { color: "var(--ink)", fontWeight: 400 },
  "class-name": { color: "var(--ink)", fontWeight: 400 },
  decorator: { color: "var(--moss)" },
  variable: { color: "var(--ink)" },
  property: { color: "var(--ink)" },
  regex: { color: "var(--ink-2)" },
  important: { color: "var(--moss)", fontWeight: 400 },
};

function Code({ language, children }: { language: string; children: string }) {
  return (
    <div className="op-inset overflow-x-auto">
      <SyntaxHighlighter language={language} style={OFFPRINT_CODE} customStyle={CODE_STYLE}>
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Code                                                              */
/* ---------------------------------------------------------------- */
export function CodeModeView({ data }: { data: CodeMode }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-[calc(32*var(--px))]">
      <p className="op-prose m-0">{data.what_it_does}</p>

      <div>
        <div className="op-figcaption mb-0 mt-0 border-t-0 pb-[calc(12*var(--px))] pt-0">
          <span className="op-label">{data.language}</span>
          <button type="button" onClick={copy} className="op-link">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <Code language={data.language}>{data.code}</Code>
      </div>

      {data.example_usage && (
        <div>
          <p className="op-label m-0 mb-[calc(12*var(--px))]">Example</p>
          <Code language={data.language}>{data.example_usage}</Code>
        </div>
      )}

      {data.caveats.length > 0 && (
        <WhereItBreaks label="Simplified from the paper">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.caveats.map((c, i) => (
              <li key={i} className="relative pl-5">
                <span aria-hidden="true" className="absolute left-0 text-accent">
                  ›
                </span>
                {c}
              </li>
            ))}
          </ul>
        </WhereItBreaks>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Analogy                                                           */
/* ---------------------------------------------------------------- */
export function AnalogyModeView({ data }: { data: AnalogyMode }) {
  return (
    <div className="flex flex-col gap-[calc(64*var(--px))]">
      {data.analogies.map((a, i) => (
        <div key={i}>
          <div className="flex flex-wrap items-baseline gap-x-[calc(18*var(--px))] gap-y-1">
            <h3 className="op-h3">{a.concept}</h3>
            <span className="op-label">via {a.domain}</span>
          </div>

          <p className="op-prose mb-0 mt-[calc(16*var(--px))]">{a.setup}</p>

          {a.mapping.length > 0 && (
            <dl className="m-0 mt-[calc(24*var(--px))] border-b border-border">
              {a.mapping.map((m, j) => {
                const [from, ...to] = m.split("→");
                return (
                  <div
                    key={j}
                    className="grid gap-1 border-t border-border py-[calc(12*var(--px))] sm:grid-cols-2 sm:gap-[calc(24*var(--px))]"
                  >
                    <dt className="font-mono text-[length:calc(14*var(--px))] font-light text-muted-foreground">
                      {from.trim()}
                    </dt>
                    <dd className="m-0 text-[length:calc(17*var(--px))]">
                      <span aria-hidden="true" className="mr-2 text-accent">
                        →
                      </span>
                      {to.join("→").trim()}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          <WhereItBreaks className="mt-[calc(28*var(--px))]">{a.where_it_breaks}</WhereItBreaks>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Story                                                             */
/* ---------------------------------------------------------------- */
export function StoryModeView({ data }: { data: StoryMode }) {
  return (
    <div>
      <ol className="m-0 flex list-none flex-col gap-[calc(48*var(--px))] p-0">
        {data.beats.map((beat, i) => (
          <li
            key={i}
            className="grid gap-2 sm:grid-cols-[calc(96*var(--px))_1fr] sm:gap-[calc(24*var(--px))]"
          >
            <span className="op-label tnum pt-[0.6em]">{beat.year ?? "—"}</span>
            <div>
              <h3 className="op-h3">{beat.heading}</h3>
              <p className="op-prose mb-0 mt-[calc(14*var(--px))]">{beat.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-[calc(56*var(--px))] border-t border-border pt-[calc(14*var(--px))]">
        <p className="op-label m-0">Where it leaves us</p>
        <p className="op-big mt-[calc(18*var(--px))]">{data.where_it_leaves_us}</p>
      </div>
    </div>
  );
}
