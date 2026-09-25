import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OgMeta, ogFonts } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Decoded — AI research, explained for humans";
export const size = OG_SIZE;
export const contentType = "image/png";

/** O cartão da capa: a abertura do Offprint, em escala de cartão. */
export default async function OgImage() {
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
      <div style={{ display: "flex", fontSize: 34, letterSpacing: "-0.02em" }}>Decoded</div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 124,
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
          }}
        >
          <span>One paper,</span>
          <span>printed alone.</span>
        </div>
        <div style={{ display: "flex", marginTop: 40 }}>
          <OgMeta items={["every AI paper", "explained for humans", "no phd required"]} />
        </div>
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
