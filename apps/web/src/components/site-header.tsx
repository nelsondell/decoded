"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignUpButton, UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/", label: "Feed" },
  { href: "/pulse", label: "Pulse" },
  { href: "/search", label: "Search" },
  { href: "/listen", label: "Listen" },
];

/**
 * Cabeçalho do Offprint: a palavra "Decoded" em Literata leve à esquerda,
 * navegação em mono à direita, a seção atual sublinhada em tinta. "Paper"
 * só aparece — já ativo, logo depois de "Feed" — quando se está lendo um.
 */
export function SiteHeader() {
  const pathname = usePathname();

  const items = pathname.startsWith("/paper/")
    ? [NAV[0], { href: pathname, label: "Paper" }, ...NAV.slice(1)]
    : NAV;

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/" || pathname === "/archive";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="op-header">
      <Link href="/" className="op-wordmark" aria-label="Decoded — home">
        Decoded
      </Link>

      <nav className="op-nav" aria-label="Primary">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="op-nav-link"
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}

        <Show when="signed-in">
          <Link
            href="/library"
            className="op-nav-link"
            aria-current={isActive("/library") ? "page" : undefined}
          >
            Library
          </Link>
          <span className="op-nav-user">
            <UserButton />
          </span>
        </Show>

        <Show when="signed-out">
          <SignUpButton mode="modal">
            <button type="button" className="op-nav-link" data-emph="">
              Sign up
            </button>
          </SignUpButton>
        </Show>
      </nav>
    </header>
  );
}
