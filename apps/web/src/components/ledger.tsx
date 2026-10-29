import Link from "next/link";

/*
  O livro de achados: a lista do site inteiro. Cada linha tem uma coluna
  de número à esquerda (o achado do paper, o score da busca, a duração do
  episódio) e o título, a frase e a linha de dados à direita. A capa, o
  arquivo, tópicos, autores, busca, biblioteca e áudio usam esta mesma
  peça, com o cabeçalho das colunas dizendo o que o número é.
*/

export function Ledger({
  columns = ["Finding", "Paper"],
  children,
}: {
  columns?: [string, string];
  children: React.ReactNode;
}) {
  return (
    <ul className="op-ledger">
      <li className="op-ledger-head" aria-hidden="true">
        <span>{columns[0]}</span>
        <span>{columns[1]}</span>
      </li>
      {children}
    </ul>
  );
}

export function LedgerRow({
  href,
  num,
  title,
  hook,
  meta,
  onClick,
  external = false,
}: {
  href: string;
  num: React.ReactNode;
  title: React.ReactNode;
  hook?: React.ReactNode;
  meta?: React.ReactNode;
  onClick?: () => void;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="op-ledger-num">{num}</span>
      <span className="op-ledger-body">
        <span className="op-ledger-title">{title}</span>
        {hook && <span className="op-ledger-hook">{hook}</span>}
        {meta && <span className="op-ledger-meta">{meta}</span>}
      </span>
    </>
  );

  return (
    <li className="op-ledger-row" data-reveal="rule" data-delay="auto">
      {external ? (
        <a href={href} className="op-ledger-link" onClick={onClick}>
          {body}
        </a>
      ) : (
        <Link href={href} className="op-ledger-link" onClick={onClick}>
          {body}
        </Link>
      )}
    </li>
  );
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** O número da coluna: valor em musgo, unidade e rótulo embaixo. */
export function LedgerNum({
  value,
  unit = "",
  label,
}: {
  value: React.ReactNode;
  unit?: string;
  label?: React.ReactNode;
}) {
  // % e × colam no número; o resto da unidade (pts, F1, "faster") desce
  const glued = unit.match(/^([%×x])(?:\s+(.*))?$/);
  const sign = glued?.[1] === "x" ? "×" : (glued?.[1] ?? "");
  const word = glued ? (glued[2] ?? "") : unit;
  // "F1" em cima de "MS MARCO answer F1" é a mesma coisa duas vezes
  const said = typeof label === "string" && new RegExp(`\\b${escape(word)}\\b`, "i").test(label);
  const rest = said ? "" : word;
  const length = String(value).length + sign.length;
  return (
    <>
      <span
        className="op-ledger-value tnum"
        data-long={length > 7 ? "xl" : length > 5 ? "" : undefined}
      >
        {value}
        {sign && <span className="op-ledger-sign">{sign}</span>}
      </span>
      {rest && <span className="op-ledger-unit">{rest}</span>}
      {label && <span className="op-ledger-label">{label}</span>}
    </>
  );
}

export function LedgerSkeleton() {
  return (
    <li className="op-ledger-row" aria-hidden="true">
      <span className="op-ledger-link">
        <span className="op-ledger-num">
          <span className="block h-[calc(30*var(--px))] w-3/4 animate-pulse bg-surface" />
        </span>
        <span className="op-ledger-body">
          <span className="block h-[calc(22*var(--px))] w-4/5 animate-pulse bg-surface" />
          <span className="mt-3 block h-4 w-3/5 animate-pulse bg-surface" />
        </span>
      </span>
    </li>
  );
}
