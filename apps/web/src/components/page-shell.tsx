import { Fragment } from "react";
import Link from "next/link";

import { RevealScope } from "@/components/offprint/offprint-motion";
import { cn } from "@/lib/utils";

/**
 * A gramática das páginas internas do Offprint.
 *
 * PageShell é a grade de 16 colunas com escopo de entradas; Masthead é o
 * cabeçalho da página, na grade inteira; Column (10 colunas) e Rail (4)
 * dividem o corpo com duas colunas de respiro. Em telas estreitas tudo
 * empilha. Estilos em app/op-pages.css.
 */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main>
      <RevealScope className={cn("op-page", className)}>{children}</RevealScope>
    </main>
  );
}

/** Palavras mascaradas; o escopo escalona por linha renderizada. */
export function WordReveal({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="op-mask op-mask--word">
            <span data-reveal="line">{word}</span>
          </span>
          {i < words.length - 1 && " "}
        </Fragment>
      ))}
    </>
  );
}

/** Títulos longos (de paper, de tópico) descem um degrau de tipo. */
function sizeFor(title: string): "l" | "m" | "s" {
  const n = title.length;
  return n <= 28 ? "l" : n <= 72 ? "m" : "s";
}

export function Masthead({
  back,
  kicker,
  title,
  lead,
  meta,
  aside,
  plate = false,
}: {
  back?: { href: string; label: string };
  kicker?: React.ReactNode;
  title: string;
  lead?: React.ReactNode;
  meta?: React.ReactNode;
  aside?: React.ReactNode;
  /** O aside é uma prancha: ocupa seis colunas em vez de cinco. */
  plate?: boolean;
}) {
  return (
    <header className="op-masthead" data-plate={plate && aside ? "" : undefined}>
      <div className="op-masthead-body">
        {back && (
          <Link
            href={back.href}
            className="op-back op-label"
            data-reveal="fade"
            data-delay="0"
          >
            ← {back.label}
          </Link>
        )}
        {kicker && (
          <div className="op-kicker op-label" data-reveal="fade" data-delay="60">
            {kicker}
          </div>
        )}
        <h1
          className="op-page-title"
          data-size={sizeFor(title)}
          data-line-stagger="120,90"
        >
          <WordReveal text={title} />
        </h1>
        {lead && (
          <div className="op-lead" data-reveal="fade" data-delay="320">
            {lead}
          </div>
        )}
        {meta && (
          <div className="op-meta op-label" data-reveal="fade" data-delay="400">
            {meta}
          </div>
        )}
      </div>
      {aside && (
        <div
          className="op-masthead-aside"
          data-reveal={plate ? undefined : "fade"}
          data-delay={plate ? undefined : "240"}
        >
          {aside}
        </div>
      )}
    </header>
  );
}

/** Coluna de leitura: dez colunas, ou a grade inteira com `wide`. */
export function Column({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("op-page-main", className)} data-wide={wide ? "" : undefined}>
      {children}
    </div>
  );
}

/** Trilho lateral: método, limites, navegação. Fixo ao rolar. */
export function Rail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn("op-page-rail", className)} data-reveal="fade" data-delay="300">
      {children}
    </aside>
  );
}

export function RailHeading({ children }: { children: React.ReactNode }) {
  return <div className="op-rail-head op-label">{children}</div>;
}

export function RailBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("op-rail-block", className)}>{children}</div>;
}

export function RailNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("op-rail-note", className)}>{children}</p>;
}

/**
 * "Where it breaks" — nomear onde a explicação para de valer é o que mais
 * constrói confiança. Um fio de musgo à esquerda, nada de caixa.
 */
export function WhereItBreaks({
  children,
  label = "Where it breaks",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("op-note", className)}>
      <div className="op-note-label op-label">{label}</div>
      <div className="op-note-body">{children}</div>
    </div>
  );
}

/** Cabeça de seção: fio acima, rótulo à esquerda, contexto à direita. */
export function SectionHead({
  label,
  aside,
  as: Tag = "h2",
}: {
  label: React.ReactNode;
  aside?: React.ReactNode;
  as?: "h2" | "h3" | "div";
}) {
  return (
    <div className="op-section-head" data-reveal="fade" data-delay="0">
      <Tag className="op-label m-0">{label}</Tag>
      {aside && <span className="op-label">{aside}</span>}
    </div>
  );
}

export function PageSection({
  id,
  label,
  aside,
  children,
  className,
}: {
  id?: string;
  label: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("op-section", className)}>
      <SectionHead label={label} aside={aside} />
      {children}
    </section>
  );
}

/** Mantido pelo nome antigo: uma seção com rótulo. */
export const SubSection = PageSection;

export function ErrorNote({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="op-note border-destructive" role="status">
      <div className="op-note-label op-label text-destructive">{title}</div>
      <div className="op-note-body">{message}</div>
    </div>
  );
}

export function Stats({ children }: { children: React.ReactNode }) {
  return (
    <div className="op-stats" data-reveal="fade" data-delay="auto">
      {children}
    </div>
  );
}

/** O número que importa: rótulo em mono, valor em Literata leve. */
export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "accent" | "muted";
}) {
  return (
    <div className="op-stat">
      <p className="op-label m-0">{label}</p>
      <p className="op-stat-value" data-tone={tone === "default" ? undefined : tone}>
        {value}
      </p>
    </div>
  );
}

/** Estado vazio: um rótulo e uma frase, entre fios. */
export function EmptyNote({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-y border-border py-[calc(44*var(--px))]">
      <p className="op-label m-0">{label}</p>
      <p className="op-big mt-[calc(16*var(--px))] max-w-[34ch]">{children}</p>
    </div>
  );
}

/** Página de aviso (404, link inválido): só o cabeçalho, com uma saída. */
export function Notice({
  kicker,
  title,
  body,
  action,
}: {
  kicker: string;
  title: string;
  body: React.ReactNode;
  action: { href: string; label: string };
}) {
  return (
    <PageShell>
      <Masthead
        kicker={<span>{kicker}</span>}
        title={title}
        lead={body}
        meta={
          <Link href={action.href} className="op-link">
            {action.label}
          </Link>
        }
      />
    </PageShell>
  );
}
