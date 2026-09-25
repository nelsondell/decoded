import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OgMeta, ogFonts } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Decoded paper summary";
export const size = OG_SIZE;
export const contentType = "image/png";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

/** O cartão de um paper: rótulo, título em Literata leve, a frase-resumo. */
export default async function OgImage({
  params,
}: {
  params: Promise<{ arxiv_id: string }>;
}) {
  // Next 16: params é uma Promise
  const { arxiv_id } = await params;

  let title = "Decoded";
  let oneSentence: string | null = null;
  let categories: string[] = [];

  try {
    const res = await fetch(`${API_BASE}/v1/papers/${arxiv_id}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const paper = await res.json();
      title = paper.title ?? title;
      oneSentence = paper.decoded?.one_sentence?.text ?? null;
      categories = (paper.categories ?? []).slice(0, 2);
    }
  } catch {
    // usa os defaults
  }

  const truncated = title.length > 110 ? `${title.slice(0, 110)}…` : title;
  const fontSize = truncated.length > 80 ? 54 : truncated.length > 50 ? 64 : 76;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: OG.vellum,
        padding: "64px 76px",
        fontFamily: "Literata",
        color: OG.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span style={{ fontSize: 34, letterSpacing: "-0.02em" }}>Decoded</span>
        <span
          style={{
            fontFamily: "DM Mono",
            fontSize: 19,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: OG.moss,
          }}
        >
          {oneSentence ? "offprint" : "in the queue"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div
          style={{
            display: "flex",
            fontSize,
            lineHeight: 1.1,
            letterSpacing: "-0.028em",
            maxWidth: 1010,
          }}
        >
          {truncated}
        </div>

        {oneSentence && (
          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.45,
              color: OG.ink2,
              maxWidth: 900,
            }}
          >
            {oneSentence.length > 130 ? `${oneSentence.slice(0, 130)}…` : oneSentence}
          </div>
        )}

        <OgMeta items={[`arXiv:${arxiv_id}`, ...categories]} />
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
