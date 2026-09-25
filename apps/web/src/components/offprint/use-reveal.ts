"use client";

import { useEffect, type RefObject } from "react";

/**
 * O motor das entradas do Offprint.
 *
 * Todo [data-reveal] começa escondido pelo CSS e ganha data-shown quando
 * entra em tela, depois do seu atraso. Três formas de atraso:
 *
 * - data-delay="260" — fixo, como no protótipo;
 * - dentro de [data-line-stagger="180,90"] — a palavra espera 180ms mais
 *   90ms por linha renderizada acima dela (a quebra real só existe aqui);
 * - data-delay="auto" — linhas de lista: 60ms por posição dentro do lote
 *   que entrou junto, para uma lista longa não acumular segundos de espera.
 *
 * Um MutationObserver pega o que chega depois do primeiro render — páginas
 * seguintes do feed, seções carregadas no cliente.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canObserve = "IntersectionObserver" in window;
    const timers: number[] = [];
    const watched = new Map<Element, HTMLElement[]>();
    const known = new WeakSet<HTMLElement>();

    const show = (el: HTMLElement) => el.setAttribute("data-shown", "");

    const topOf = (el: HTMLElement) =>
      Math.round((el.parentElement ?? el).getBoundingClientRect().top + window.scrollY);

    const delayOf = (el: HTMLElement, batchIndex: number): number => {
      const block = el.closest<HTMLElement>("[data-line-stagger]");
      if (block && el.dataset.reveal === "line") {
        const [base, step] = (block.dataset.lineStagger ?? "0,90").split(",").map(Number);
        const tops: number[] = [];
        block.querySelectorAll<HTMLElement>('[data-reveal="line"]').forEach((w) => {
          const t = topOf(w);
          if (!tops.some((x) => Math.abs(x - t) < 4)) tops.push(t);
        });
        const mine = topOf(el);
        return base + Math.max(0, tops.findIndex((x) => Math.abs(x - mine) < 4)) * step;
      }
      if (el.dataset.delay === "auto") return Math.min(batchIndex, 8) * 60;
      return parseInt(el.dataset.delay ?? "0", 10) || 0;
    };

    const fire = (watch: Element, batchIndex: number) => {
      (watched.get(watch) ?? []).forEach((el) => {
        timers.push(window.setTimeout(() => show(el), delayOf(el, batchIndex)));
      });
      watched.delete(watch);
    };

    const io = canObserve
      ? new IntersectionObserver(
          (entries) => {
            const hits = entries
              .filter((e) => e.isIntersecting && watched.has(e.target))
              .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            hits.forEach((e, i) => {
              fire(e.target, i);
              io?.unobserve(e.target);
            });
          },
          { threshold: 0.15 },
        )
      : null;

    const register = (nodes: HTMLElement[]) => {
      const fresh = nodes.filter((el) => !known.has(el));
      fresh.forEach((el) => known.add(el));
      if (fresh.length === 0) return;

      if (reduce || !io) {
        fresh.forEach((el) => {
          el.style.transitionDuration = "0s";
          show(el);
        });
        return;
      }

      const added: Element[] = [];
      fresh.forEach((el) => {
        // Uma linha recortada tem área pintada zero: observa a máscara
        const watch = el.dataset.reveal === "line" ? (el.parentElement ?? el) : el;
        const list = watched.get(watch);
        if (list) list.push(el);
        else {
          watched.set(watch, [el]);
          added.push(watch);
        }
      });

      let batch = 0;
      added.forEach((w) => {
        const r = w.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) fire(w, batch++);
        else io.observe(w);
      });
    };

    const collect = (node: ParentNode): HTMLElement[] =>
      Array.from(node.querySelectorAll<HTMLElement>("[data-reveal]"));

    register(collect(scope));

    const mo = new MutationObserver((records) => {
      const nodes: HTMLElement[] = [];
      records.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches("[data-reveal]")) nodes.push(n);
          nodes.push(...collect(n));
        }),
      );
      if (nodes.length) register(nodes);
    });
    mo.observe(scope, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io?.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [root]);
}
