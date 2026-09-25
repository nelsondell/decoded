/**
 * Elementos da marca que sobreviveram ao Offprint.
 */

/**
 * Texto redigido — o paper ainda não decodificado. Barras no lugar das
 * palavras que ainda não existem.
 */
export function Redacted({
  className,
  width = 150,
  seed = 0,
}: {
  className?: string;
  width?: number;
  seed?: number;
}) {
  // Quatro larguras por linha, variadas de forma determinística pelo seed,
  // para que duas linhas seguidas não fiquem idênticas.
  const rows = [
    [86, 40],
    [54, 72],
  ];
  const shift = (seed % 3) * 8;

  return (
    <svg
      viewBox="0 0 200 26"
      width={width}
      height={(width * 26) / 200}
      className={className}
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <g fill="var(--accent-soft)">
        {rows.map((row, i) => {
          const first = row[0] + (i === 0 ? shift : -shift);
          const second = row[1] - (i === 0 ? shift : -shift);
          return (
            <g key={i}>
              <rect x="0" y={i === 0 ? 2 : 15} width={first} height="7" />
              <rect
                x={first + 8}
                y={i === 0 ? 2 : 15}
                width={second}
                height="7"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
