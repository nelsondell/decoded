/*
  Os ícones de texto do site: setas e o mais/menos dos links em mono.
  Desenhados no mesmo traço dos glifos do decode visual (grade 16, linha
  fina, ponta reta), para que nenhum link dependa de um caractere Unicode
  que muda de desenho de fonte para fonte.
*/

const PATHS = {
  "arrow-right": "M2.5 8h10.5M9.5 4.5 13 8l-3.5 3.5",
  "arrow-left": "M13.5 8H3M6.5 4.5 3 8l3.5 3.5",
  "arrow-out": "M5 11 11.5 4.5M6 4.5h5.5V10",
  plus: "M8 3v10M3 8h10",
  minus: "M3 8h10",
  check: "M3 8.5 6.5 12 13 4.5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      className={className ? `op-icon ${className}` : "op-icon"}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
