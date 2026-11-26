const isDev = process.env.NODE_ENV === "development";

// script-src switches from 'unsafe-inline' to a per-request nonce
// ('nonce-{value}' 'strict-dynamic') once src/proxy.ts generates one
// (design.md, "Nonce de CSP generado por petición en src/proxy.ts y
// propagado vía x-nonce"; node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md, "Adding a nonce with Proxy"). Without a
// nonce, script-src falls back to 'unsafe-inline': next.config.ts's
// static headers() keeps working as a safety net for any route the proxy
// does not process (Requirement "Nonces de CSP" only forbids 'unsafe-inline'
// for scripts once a nonce is available).
function scriptSrc(nonce: string | undefined): string {
  const base = nonce
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "'self' 'unsafe-inline'";
  // posthog-js fetches its remote config and lazy modules as scripts.
  return `script-src ${base} https://*.posthog.com${isDev ? " 'unsafe-eval'" : ""}`;
}

// style-src never carries the nonce: nonces do not cover style=""
// attributes, so a nonce-based style-src blocks every server-rendered inline
// style on a hard load (progress bar widths, for instance, render at 100 %).
function styleSrc(): string {
  return "style-src 'self' 'unsafe-inline'";
}

// Only the configured Supabase project is allowed, not every project under
// supabase.co (security-hardening S8). Tolerant like
// image-remote-patterns.ts: next.config.ts is evaluated by tooling that runs
// without the app env, so an absent or malformed variable falls back to the
// wildcard instead of throwing. The scheme and port are kept so a local
// Supabase (http://127.0.0.1:54321) still works.
function supabaseSources(supabaseUrl: string | undefined): {
  http: string;
  ws: string;
} {
  const wildcard = { http: "https://*.supabase.co", ws: "wss://*.supabase.co" };
  if (!supabaseUrl) return wildcard;
  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    return wildcard;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return wildcard;
  const secure = url.protocol === "https:";
  return {
    http: `${secure ? "https" : "http"}://${url.host}`,
    ws: `${secure ? "wss" : "ws"}://${url.host}`,
  };
}

function buildContentSecurityPolicy(
  nonce: string | undefined,
  supabaseUrl: string | undefined,
): string {
  const supabase = supabaseSources(supabaseUrl);
  return [
    "default-src 'self'",
    scriptSrc(nonce),
    styleSrc(),
    // The Supabase host matches connect-src's "the configured Supabase
    // project" (design.md, "images.remotePatterns y img-src de CSP en el
    // mismo pase"): getAssetReadUrl's signed read URLs are served from that
    // same host.
    `img-src 'self' blob: data: https://*.googleusercontent.com ${supabase.http}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase.http} ${supabase.ws} https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.posthog.com https://*.i.posthog.com`,
    "worker-src 'self' blob: data:",
    // The editor's YouTube embed (editor/ui/tiptap/extensions/youtube.ts)
    // always renders from youtube-nocookie.com. 'self' keeps same-origin
    // frames allowed, as they were through default-src 'self' before
    // frame-src existed.
    "frame-src 'self' https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${supabase.http} https://accounts.google.com`,
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function buildHeaders(csp: string): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    // Two years, as node_modules/next/dist/docs/01-app/03-api-reference/
    // 05-config/01-next-config-js/headers.md suggests, without `preload`:
    // the preload list is hard to leave. Browsers ignore it over plain HTTP,
    // so localhost is unaffected.
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000",
    },
    // allow-popups: a window Cogni opens (Google sign-in) keeps working.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    // Other sites cannot embed Cogni's own responses (images, scripts).
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ];
}

// Used by src/proxy.ts, which generates a fresh nonce per request (design.md,
// Slice 8 decision "Nonce de CSP generado por petición en src/proxy.ts").
// NEXT_PUBLIC_SUPABASE_URL is read directly, not through clientEnv(), so this
// file stays loadable without the app env.
export function buildSecurityHeaders(
  nonce: string,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): { key: string; value: string }[] {
  return buildHeaders(buildContentSecurityPolicy(nonce, supabaseUrl));
}

// Static export kept for next.config.ts's headers(): a safety net for any
// route outside the proxy's matcher, where no nonce is ever generated.
export const securityHeaders = buildHeaders(
  buildContentSecurityPolicy(undefined, process.env.NEXT_PUBLIC_SUPABASE_URL),
);
