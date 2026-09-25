"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EVENTS, capture } from "@/lib/analytics";

const EXAMPLES = [
  "how do models learn from fewer examples",
  "robots that imitate human motion",
  "why benchmarks overstate reasoning ability",
  "cutting inference cost without losing accuracy",
];

/**
 * A pergunta em Literata no tamanho de um título, sobre um fio de tinta.
 * Sem pergunta ainda, os exemplos aparecem como as linhas do arquivo.
 */
export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submit(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    capture(EVENTS.SEARCH_PERFORMED, {
      query_length: trimmed.length,
      from_example: EXAMPLES.includes(trimmed),
    });
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div>
      <form
        className="op-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <label htmlFor="ask" className="op-label flex-none text-accent">
          Ask
        </label>
        <input
          id="ask"
          ref={inputRef}
          type="search"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="what are you trying to understand?"
        />
        {value.trim().length >= 2 && (
          <button type="submit" className="op-link flex-none">
            Search →
          </button>
        )}
      </form>

      {!params.get("q") && (
        <div className="mt-[calc(64*var(--px))]">
          <p className="op-label m-0 mb-[calc(18*var(--px))]">Try</p>
          <ul className="op-archive-list">
            {EXAMPLES.map((ex, i) => (
              <li key={ex} data-reveal="fade" data-delay="auto">
                <button
                  type="button"
                  onClick={() => {
                    setValue(ex);
                    submit(ex);
                  }}
                  className="op-row w-full border-0 bg-transparent text-left"
                  data-size="s"
                  data-cur="ask"
                >
                  <span>{ex}</span>
                  <span className="op-row-count">{String(i + 1).padStart(2, "0")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
