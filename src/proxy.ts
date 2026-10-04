import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/modules/identity/infrastructure/supabase-proxy-client";
import { clientEnv } from "@/shared/config/env.client";
import { buildSecurityHeaders } from "@/shared/config/security-headers";

// Next.js 16 renamed middleware to proxy. It refreshes the Supabase session
// before any route handler or Server Action runs, sends visitors without a
// session to /login and keeps signed-in users away from the auth screens.
const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password"]);
// Always reachable, signed in or not: the terms of use are read before
// signing up and are where the (app) gate sends accounts that still have to
// accept them. Unlike AUTH_PATHS, signed-in users are not bounced from here.
const OPEN_PATHS = new Set(["/terminos"]);

function bareHost(host: string): string {
  return host.replace(/^www\./, "");
}

// design.md, Slice 8 decision "Redirect del dominio apex hacia el host
// canónico en src/proxy.ts": redirect only when the request host and the
// canonical host (NEXT_PUBLIC_SITE_URL) are the apex/`www` variant of the
// same domain. A completely unrelated host (Vercel preview, localhost, CI)
// is left untouched.
function apexRedirectTarget(request: NextRequest): URL | null {
  const canonical = new URL(clientEnv().NEXT_PUBLIC_SITE_URL);
  const requestHost = request.nextUrl.hostname;
  if (requestHost === canonical.hostname) return null;
  if (bareHost(requestHost) !== bareHost(canonical.hostname)) return null;
  return new URL(
    `${clientEnv().NEXT_PUBLIC_SITE_URL}${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
}

function withCookies(target: URL, source: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(target);
  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function proxy(request: NextRequest) {
  const apexTarget = apexRedirectTarget(request);
  if (apexTarget) {
    // Permanent (308): the apex/www variant never becomes the canonical URL
    // again, so browsers and crawlers are told to stop asking for it.
    return NextResponse.redirect(apexTarget, 308);
  }

  // node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
  // "Adding a nonce with Proxy": a fresh nonce per request, written on the
  // request headers (so Server Components can read it via `x-nonce`, and so
  // Next.js can parse 'nonce-{value}' from the request's own CSP header
  // while rendering) and mirrored onto the response headers sent back.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildSecurityHeaders(nonce).find(
    (header) => header.key === "Content-Security-Policy",
  )?.value;
  if (!csp) {
    throw new Error("buildSecurityHeaders did not return a CSP header");
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  // Layouts cannot read the pathname; the (app) terms gate needs it to send
  // the visitor back where they were (`next`) after accepting.
  requestHeaders.set(
    "x-pathname",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const requestWithNonce = new NextRequest(request, {
    headers: requestHeaders,
  });

  const { response, user } = await updateSession(requestWithNonce);
  response.headers.set("Content-Security-Policy", csp);

  const { pathname } = request.nextUrl;
  const isAuthPath = AUTH_PATHS.has(pathname);
  const isCallback = pathname.startsWith("/auth/");
  const isOpenPath = OPEN_PATHS.has(pathname);

  if (!user && !isAuthPath && !isCallback && !isOpenPath) {
    const redirect = withCookies(new URL("/login", request.url), response);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }
  if (user && isAuthPath) {
    const redirect = withCookies(new URL("/", request.url), response);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }
  return response;
}

// Route handlers under /api authenticate on their own (the cron bearer is
// not a browser session) and /monitoring is the Sentry tunnel: redirecting
// either to /login silently drops cron pings and error reports. The
// `(?:/|$)` anchor keeps a route like /monitoring-extra from being excluded
// just because it shares the same prefix as the tunnel route (Requirement
// "Anclaje del proxy matcher a rutas de aplicación").
export const config = {
  matcher: [
    "/((?!api/|monitoring(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
