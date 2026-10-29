import type { Glyph as GlyphName } from "@/lib/visual-types";

/*
  Glifos de traço fino, 24×24, na cor do texto. Desenhados à mão no mesmo
  peso das réguas do Offprint — nada de ícone cheio ou colorido.
*/
const PATHS: Record<GlyphName, React.ReactNode> = {
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.33c-.55.22-.9.74-.9 1.33V14" />
      <path d="M12 17.2v.3" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v12c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6" />
      <path d="M5 12c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5" />
    </>
  ),
  model: (
    <>
      <circle cx="5" cy="7" r="1.6" />
      <circle cx="5" cy="17" r="1.6" />
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
      <path d="M6.5 7.5 10.5 5.5M6.5 7.5l4 4M6.5 16.5l4-4M6.5 16.5l4 2M13.5 5.5l4 5.5M13.6 12h3.8M13.5 18.5l4-5.5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.7 2.7L16.2 9.5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 10v4.5M12 17v.3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5.5 5.5" />
    </>
  ),
  text: (
    <>
      <path d="M4 6h16M4 10h16M4 14h10M4 18h13" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4" />
    </>
  ),
  robot: (
    <>
      <rect x="5" y="8" width="14" height="11" />
      <path d="M12 4.5V8M9.5 13v.5M14.5 13v.5M9.5 16.5h5M3 12.5v3M21 12.5v3" />
      <circle cx="12" cy="4" r="0.9" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10M5 7h14" />
      <path d="M5 7 2.5 13a2.6 2.6 0 0 0 5 0zM19 7l-2.5 6a2.6 2.6 0 0 0 5 0z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  compare: (
    <>
      <path d="M4 20V10M10 20V4M14 20v-7M20 20V8" />
      <path d="M2.5 20h19" />
    </>
  ),
};

export function Glyph({
  name,
  size = 28,
  className,
}: {
  name: GlyphName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.15}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name] ?? PATHS.question}
    </svg>
  );
}
