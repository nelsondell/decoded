/**
 * Peças comuns dos cartões sociais (ImageResponse) no registro do Offprint.
 *
 * O satori não lê next/font nem WOFF2, então as faces vêm da API do Google
 * Fonts em TTF, com cache de um dia. Se a busca falhar, o cartão sai com a
 * fonte padrão — um cartão feio ainda é melhor que um 500.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  vellum: "#F4F2EC",
  rule: "#DCD8CB",
  ink: "#171A16",
  ink2: "#4E534B",
  ink3: "#7C8179",
  moss: "#3D5233",
} as const;

async function googleFont(query: string): Promise<ArrayBuffer | null> {
  try {
    // Sem user agent de navegador, a API responde com TTF
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${query}`, {
      next: { revalidate: 86400 },
    }).then((r) => r.text());
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function ogFonts() {
  const [display, mono] = await Promise.all([
    googleFont("Literata:opsz,wght@72,300"),
    googleFont("DM+Mono:wght@300"),
  ]);
  return [
    ...(display ? [{ name: "Literata", data: display, weight: 300 as const, style: "normal" as const }] : []),
    ...(mono ? [{ name: "DM Mono", data: mono, weight: 300 as const, style: "normal" as const }] : []),
  ];
}

/** Linha de rótulos em mono, com fio acima — o .op-meta da capa. */
export function OgMeta({ items }: { items: string[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 34,
        paddingTop: 20,
        borderTop: `1.5px solid ${OG.rule}`,
        fontFamily: "DM Mono",
        fontSize: 19,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: OG.ink3,
      }}
    >
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
