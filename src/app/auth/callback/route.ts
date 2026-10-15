import { after, NextResponse } from "next/server";
import { exchangeCodeForSession, safeNext } from "@/modules/identity";
import { clientEnv } from "@/shared/config/env.client";
import { createServerAnalytics } from "@/shared/observability/analytics";

function analytics() {
  const env = clientEnv();
  return createServerAnalytics({
    key: env.NEXT_PUBLIC_POSTHOG_KEY,
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}

// Google OAuth, email verification and password-reset links all land here
// with a PKCE code; `next` is sanitised against open redirects. Any
// successful exchange opens a session and tracks `user_signed_in`
// (specs/observability-and-delivery/spec.md, "Evento `user_signed_in` en
// el callback de OAuth"), deferred past the response via `after()`.
// A missing or rejected code sends the visitor back to login with the
// message for its flow. signInWithGoogleAction (identity/actions.ts) marks
// the Google flow with a short-lived `cogni_auth_flow=google` cookie scoped
// to this path, keeping the redirect URL byte-identical to the Supabase
// allowlist entry; only that flow gets the "Google cancelled" copy, and a
// failed email-verification or password-reset link (no cookie) gets
// `error=link`, the invalid/expired link copy. Every response clears the
// cookie so it never outlives this callback.
const FLOW_COOKIE = "cogni_auth_flow";

function isGoogleFlow(request: Request): boolean {
  const header = request.headers.get("cookie") ?? "";
  return header
    .split(";")
    .some((pair) => pair.trim() === `${FLOW_COOKIE}=google`);
}

function clearFlowCookie(response: NextResponse): NextResponse {
  response.cookies.set(FLOW_COOKIE, "", {
    path: "/auth/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const result = await exchangeCodeForSession(code);
    if (result.ok) {
      if (result.userId) {
        const userId = result.userId;
        after(() => analytics().track("user_signed_in", userId));
      }
      return clearFlowCookie(NextResponse.redirect(`${origin}${next}`));
    }
  }
  const error = isGoogleFlow(request) ? "google" : "link";
  return clearFlowCookie(
    NextResponse.redirect(`${origin}/login?error=${error}`),
  );
}
