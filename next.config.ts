import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/shared/config/security-headers";

const nextConfig: NextConfig = {
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
