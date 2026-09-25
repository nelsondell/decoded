import type { Metadata } from "next";
import { DM_Mono, Literata } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/posthog-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CursorDot } from "@/components/offprint/cursor-dot";

// Duas faces, duas funções. Literata leve carrega tudo que se lê como texto,
// do título de 128px ao corpo; o eixo óptico deixa a mesma família servir
// aos dois. DM Mono leve marca o que é dado: IDs do arXiv, datas, rótulos.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

// Sem JS, nada fica escondido esperando uma animação de entrada
const NO_SCRIPT_REVEAL = `[data-reveal]{opacity:1!important;clip-path:none!important;transform:none!important}[data-bar],[data-barx]{transform:none!important}[data-draw]{stroke-dashoffset:0!important}`;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Decoded — AI research, explained for humans",
    template: "%s · Decoded",
  },
  description:
    "Every new AI paper from arXiv, translated into something you can actually read. TL;DRs, deep dives, figure explanations, and analogies. No PhD required.",
  keywords: [
    "AI research",
    "machine learning papers",
    "arXiv",
    "paper summaries",
    "LLM research",
    "AI explained",
  ],
  authors: [{ name: "Nelson Dell" }],
  openGraph: {
    type: "website",
    siteName: "Decoded",
    title: "Decoded — AI research, explained for humans",
    description:
      "Every new AI paper, translated into something you can actually read.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Decoded — AI research, explained for humans",
    description:
      "Every new AI paper, translated into something you can actually read.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${literata.variable} ${dmMono.variable}`}>
        <body>
          <noscript>
            <style>{NO_SCRIPT_REVEAL}</style>
          </noscript>
          <PostHogProvider>
            <Providers>
              <div className="op-frame flex min-h-screen flex-col">
                <SiteHeader />
                <div className="flex-1">{children}</div>
                <SiteFooter />
              </div>
              <CursorDot />
            </Providers>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
