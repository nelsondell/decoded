"use client";

import { useEffect, useState } from "react";

export interface NavItem {
  id: string;
  label: string;
}

/**
 * Índice do paper no trilho: mono, a seção atual em musgo, e o progresso
 * de leitura como um fio que se enche — nada de barra.
 */
export function PaperNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    function onScroll() {
      const total = document.body.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(window.scrollY / total, 1) : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="hidden lg:block" aria-label="On this page">
      <div className="op-rail-head op-label">On this page</div>

      <ol className="m-0 flex list-none flex-col gap-[calc(12*var(--px))] p-0 pt-[calc(18*var(--px))]">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "true" : undefined}
              className={`flex items-baseline gap-[calc(14*var(--px))] font-mono text-[length:var(--t-mono)] font-light tracking-[0.06em] ${
                active === item.id ? "text-accent" : "text-muted-foreground"
              }`}
            >
              <span className="tnum text-subtle">{String(i + 1).padStart(2, "0")}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ol>

      <div className="mt-[calc(22*var(--px))] h-px w-full bg-border" aria-hidden="true">
        <div className="h-px bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>

      <p className="op-rail-note">
        Every layer here is generated from the paper itself. The PDF is one
        click away.
      </p>
    </nav>
  );
}
