import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/modules/identity/infrastructure/supabase-proxy-client";
import { clientEnv } from "@/shared/config/env.client";

// Next.js 16 renamed middleware to proxy. It refreshes the Supabase session
// before any route handler or Server Action runs, sends visitors without a
// session to /login and keeps signed-in users away from the auth screens.
const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password"]);

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

  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isAuthPath = AUTH_PATHS.has(pathname);
  const isCallback = pathname.startsWith("/auth/");

  if (!user && !isAuthPath && !isCallback) {
    return withCookies(new URL("/login", request.url), response);
  }
  if (user && isAuthPath) {
    return withCookies(new URL("/", request.url), response);
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
