const isDev = process.env.NODE_ENV === "development";

// Static CSP (no nonces): Next.js needs 'unsafe-inline' for its hydration
// scripts and Tailwind for style attributes. Supabase, Sentry and PostHog
// are the only remote origins the browser talks to. HSTS is added by Vercel.
const contentSecurityPolicy = [
  "default-src 'self'",
  // posthog-js fetches its remote config and lazy modules as scripts.
  `script-src 'self' 'unsafe-inline' https://*.posthog.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // https://*.supabase.co matches connect-src's existing pattern for "the
  // configured Supabase project" (design.md, "images.remotePatterns y
  // img-src de CSP en el mismo pase"): getAssetReadUrl's signed read URLs
  // are served from that same host.
  "img-src 'self' blob: data: https://*.googleusercontent.com https://*.supabase.co",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.posthog.com https://*.i.posthog.com",
  "worker-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.supabase.co https://accounts.google.com",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];
