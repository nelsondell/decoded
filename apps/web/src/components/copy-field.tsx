"use client";

import { useEffect, useRef, useState } from "react";

/** Campo de leitura com botão de copiar. Usado pela URL do feed do podcast. */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard bloqueado — o texto continua selecionável ao lado
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-[calc(24*var(--px))] gap-y-3 border-b border-foreground pb-[calc(14*var(--px))]">
      <code className="min-w-0 flex-[1_1_260px] overflow-x-auto font-mono text-[length:calc(16*var(--px))] font-light text-foreground">
        {value}
      </code>
      <button type="button" onClick={copy} className="op-link flex-none">
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
