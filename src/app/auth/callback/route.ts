import { after, NextResponse } from "next/server";
import {
  AUTH_CALLBACK_PATH,
  AUTH_FLOW_COOKIE,
  exchangeCodeForSession,
  isGoogleAuthFlow,
  recordSignUpConsentForUser,
  safeNext,
  TERMS_CONSENT_COOKIE,
  TERMS_VERSION,
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
// Sign-up consent (feature legal-consent): a successful exchange copies the
// proof given before the account existed — the TERMS_CONSENT_COOKIE set
// next to the Google button, or the email sign-up metadata — into a
// brand-new profile before the redirect, so the (app) gate lets it in.
// Only the Google stamp emits `terms_accepted` here (source
// `oauth_callback`); the email one was tracked at sign-up. The consent
// cookie is cleared with the flow cookie.
function clearFlowCookie(response: NextResponse): NextResponse {
  for (const name of [AUTH_FLOW_COOKIE, TERMS_CONSENT_COOKIE]) {
    response.cookies.set(name, "", { path: AUTH_CALLBACK_PATH, maxAge: 0 });
  }
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
        const consent = await recordSignUpConsentForUser({
          userId,
          accountCreatedAt: result.createdAt,
          userMetadata: result.userMetadata,
          cookieHeader: request.headers.get("cookie"),
        });
        after(() => {
          const events = analytics();
          events.track("user_signed_in", userId);
          if (consent.stamped && consent.method === "google") {
            events.track("terms_accepted", userId, {
              version: TERMS_VERSION,
              source: "oauth_callback",
            });
          }
        });
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
