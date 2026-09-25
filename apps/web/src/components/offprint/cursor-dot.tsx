"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Ponto de 7px que segue o ponteiro com atraso (lerp 0.18) e vira um anel
 * de 54px em musgo sobre qualquer [data-cur], mostrando o valor do atributo.
 * Só em ponteiro fino, e nunca com movimento reduzido.
 */
export function CursorDot() {
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = dot.current;
    if (!el) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    let raf = 0;

    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      el.setAttribute("data-visible", "");
    };

    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.transform = `translate(${cx}px, ${cy}px)`;
      raf = requestAnimationFrame(tick);
    };

    const over = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const hit = target?.closest<HTMLElement>("[data-cur]") ?? null;
      if (hit) el.setAttribute("data-on", "");
      else el.removeAttribute("data-on");
      if (label.current) label.current.textContent = hit?.dataset.cur ?? "";
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", over, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
    };
  }, []);

  // O elemento sob o ponteiro some na navegação; o anel não pode ficar
  useEffect(() => {
    dot.current?.removeAttribute("data-on");
  }, [pathname]);

  return (
    <div ref={dot} className="op-cursor" aria-hidden="true">
      <span ref={label} className="op-cursor-label" />
    </div>
  );
}
