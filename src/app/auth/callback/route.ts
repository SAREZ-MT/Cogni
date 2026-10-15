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
// message for its flow: Google's redirectTo carries `flow=google`
// (identity/actions.ts, signInWithGoogleAction), so only that flow gets the
// "Google cancelled" copy; a failed email-verification or password-reset
// link (no marker) gets `error=link`, the invalid/expired link copy.
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
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  const error = searchParams.get("flow") === "google" ? "google" : "link";
  return NextResponse.redirect(`${origin}/login?error=${error}`);
}
