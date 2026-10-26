import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { supabaseImageRemotePatterns } from "./src/shared/config/image-remote-patterns";
import { securityHeaders } from "./src/shared/config/security-headers";

const nextConfig: NextConfig = {
  // document-import T6: officeparser (DOCX enrichment, later PPTX/PDF) is
  // loaded with Node's own require instead of being bundled: Turbopack
  // breaks its ESM wrapper (T0 spike). Its optional @napi-rs/canvas is
  // never required on the DOCX path.
  serverExternalPackages: ["officeparser"],
  images: {
    // Derived without clientEnv(): this file must stay loadable when the
    // app env is absent (see image-remote-patterns.ts).
    remotePatterns: supabaseImageRemotePatterns(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
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
