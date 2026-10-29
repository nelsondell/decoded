"use client";

import { useRef } from "react";
import { useReveal } from "./use-reveal";

/** Escopo de entradas: toda página monta o motor uma vez, aqui. */
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
