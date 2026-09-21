import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { clientEnv } from "./src/shared/config/env.client";
import { securityHeaders } from "./src/shared/config/security-headers";

// design.md, "images.remotePatterns y img-src de CSP en el mismo pase":
// only the exact configured Supabase project host, scoped to the read
// signed-URL path (`getAssetReadUrl` returns URLs under
// `/storage/v1/object/sign/...`).
const supabaseStorageHost = new URL(clientEnv().NEXT_PUBLIC_SUPABASE_URL)
  .hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseStorageHost,
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

// Source maps upload only when SENTRY_AUTH_TOKEN, SENTRY_ORG and
// SENTRY_PROJECT are present (Vercel production build); locally it is a
// plain Next build. The tunnel keeps Sentry traffic same-origin for the CSP.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
