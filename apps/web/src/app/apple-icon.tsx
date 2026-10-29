import { ImageResponse } from "next/og";
import { iconFont } from "@/lib/og";
import { Mark } from "./icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** O mesmo D, no tamanho da tela inicial do iPhone. */
export default async function AppleIcon() {
  return new ImageResponse(<Mark size={180} />, { ...size, fonts: await iconFont() });
}
