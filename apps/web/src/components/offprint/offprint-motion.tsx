"use client";

import { useEffect, useRef, useState } from "react";
import { pad2 } from "@/lib/offprint";
import { useReveal } from "./use-reveal";

/**
 * Entradas e contador da capa. As entradas vêm de useReveal; o contador
 * troca quando um offprint passa de metade da tela.
 */
export function OffprintMotion({
  total,
  children,
}: {
  total: number;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState<string | null>(null);

  useReveal(root);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;

    const sections = Array.from(scope.querySelectorAll<HTMLElement>("[data-count]"));
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          setCount((e.target as HTMLElement).dataset.count ?? null);
        });
      },
      { threshold: 0.5 },
    );
    sections.forEach((s) => cio.observe(s));
    return () => cio.disconnect();
  }, []);

  // Some na abertura e no colofão, onde encostaria no rodapé
  const visible = count !== null && count !== "00" && count !== "end";

  return (
    <div ref={root}>
      {children}
      <div
        className="op-counter tnum"
        aria-hidden="true"
        data-visible={visible ? "" : undefined}
      >
        {visible ? count : "01"} / {pad2(total)}
      </div>
    </div>
  );
}

/** Escopo de entradas para as páginas internas. */
export function RevealScope({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
