import Link from "next/link";

const LINKS = [
  { href: "/archive", label: "archive" },
  { href: "/topics", label: "topics" },
  { href: "/authors", label: "authors" },
  { href: "/institutions", label: "institutions" },
  { href: "/feed.xml", label: "rss", external: true },
  { href: "https://arxiv.org", label: "arxiv", external: true },
];

/** Colofão: um fio, uma linha de mono, os índices. */
export function SiteFooter() {
  return (
    <footer className="op-footer">
      <span>Decoded · built by Nelson Dell · {new Date().getFullYear()}</span>

      <nav aria-label="Index">
        {LINKS.map((link) =>
          link.external ? (
            <a
              key={link.href}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ),
        )}
      </nav>
    </footer>
  );
}
