import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/modules/identity/infrastructure/supabase-proxy-client";

// Next.js 16 renamed middleware to proxy. It refreshes the Supabase session
// before any route handler or Server Action runs, sends visitors without a
// session to /login and keeps signed-in users away from the auth screens.
const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password"]);

function withCookies(target: URL, source: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(target);
  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function proxy(request: NextRequest) {
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
// either to /login silently drops cron pings and error reports.
export const config = {
  matcher: [
    "/((?!api/|monitoring|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
