import { after, NextResponse } from "next/server";
import {
  AUTH_CALLBACK_PATH,
  AUTH_FLOW_COOKIE,
  exchangeCodeForSession,
  isGoogleAuthFlow,
  safeNext,
} from "@/modules/identity";
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
// the Google flow with the short-lived AUTH_FLOW_COOKIE scoped to this path
// (contract in identity/domain/auth-flow.ts), keeping the redirect URL
// byte-identical to the Supabase allowlist entry; only that flow gets the
// "Google cancelled" copy, and a failed email-verification or
// password-reset link (no cookie) gets `error=link`, the invalid/expired
// link copy. Every response clears the cookie so it never outlives this
// callback.
function clearFlowCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_FLOW_COOKIE, "", {
    path: AUTH_CALLBACK_PATH,
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
  const error = isGoogleAuthFlow(request.headers.get("cookie"))
    ? "google"
    : "link";
  return clearFlowCookie(
    NextResponse.redirect(`${origin}/login?error=${error}`),
  );
}
