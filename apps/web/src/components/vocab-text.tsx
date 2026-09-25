"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { VocabTerm } from "@/lib/decoded-types";
import { useMemo } from "react";
import { EVENTS, capture } from "@/lib/analytics";

/**
 * Renderiza texto marcando termos do vocabulário com popover de definição.
 *
 * A busca é case-insensitive e respeita limites de palavra, para não marcar
 * "RAG" dentro de "storage".
 */
export function VocabText({
  text,
  terms,
}: {
  text: string;
  terms: VocabTerm[];
}) {
  const segments = useMemo(() => splitByTerms(text, terms), [text, terms]);

  return (
    <>
      {segments.map((seg, i) => {
        const term = seg.term;
        return term ? (
          <Popover key={i}>
            {/* Um span, não um <button>: o termo quebra linha como texto
                corrido em vez de saltar inteiro para a linha seguinte */}
            <PopoverTrigger
              nativeButton={false}
              render={<span />}
              className="cursor-help border-b border-accent-light transition-colors hover:border-accent hover:text-accent"
              data-cur="define"
              onClick={() => capture(EVENTS.VOCAB_TERM_OPENED, { term: term.term })}
            >
              {seg.text}
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-[calc(320*var(--px))] min-w-64 border border-border bg-background p-[calc(20*var(--px))] shadow-none ring-0"
            >
              <p className="op-label m-0 text-accent">
                {term.term}
              </p>
              <p className="mb-0 mt-[calc(10*var(--px))] font-serif text-[length:calc(17*var(--px))] font-light leading-[1.55] text-foreground">
                {term.definition}
              </p>
            </PopoverContent>
          </Popover>
        ) : (
          <span key={i}>{seg.text}</span>
        );
      })}
    </>
  );
}

interface Segment {
  text: string;
  term?: VocabTerm;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitByTerms(text: string, terms: VocabTerm[]): Segment[] {
  if (terms.length === 0) return [{ text }];

  // Termos mais longos primeiro, para "chain-of-thought" ganhar de "chain"
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);

  const pattern = sorted.map((t) => escapeRegex(t.term)).join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");

  const byLower = new Map(sorted.map((t) => [t.term.toLowerCase(), t]));
  const seen = new Set<string>();

  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matched = match[0];
    const key = matched.toLowerCase();
    const term = byLower.get(key);

    // Marca só a primeira ocorrência de cada termo
    if (!term || seen.has(key)) continue;
    seen.add(key);

    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    segments.push({ text: matched, term });
    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}
