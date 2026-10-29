import { ImageResponse } from "next/og";
import { OG, iconFont } from "@/lib/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** O ícone da aba: o D de Decoded em papel sobre musgo, quadrado como o resto do site. */
export default async function Icon() {
  return new ImageResponse(<Mark size={32} />, { ...size, fonts: await iconFont() });
}

export function Mark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: OG.moss,
        color: OG.vellum,
        fontFamily: "Literata",
        fontWeight: 500,
        fontSize: size * 0.78,
        lineHeight: 1,
        paddingTop: size * 0.04,
      }}
    >
      D
    </div>
  );
}
