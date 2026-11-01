import type { NextConfig } from "next";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

const nextConfig: NextConfig = {
  // Necessário para o proxy do PostHog funcionar
  skipTrailingSlashRedirect: true,

  // O áudio está desligado por enquanto: links antigos voltam para a capa
  async redirects() {
    return [{ source: "/listen", destination: "/", permanent: false }];
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
      // PostHog servido pelo próprio domínio — bloqueadores não pegam
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: `${POSTHOG_HOST}/:path*`,
      },
    ];
  },
};

export default nextConfig;