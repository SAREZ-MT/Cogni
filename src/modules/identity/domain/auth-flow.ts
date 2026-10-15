// Contract for the short-lived cookie that marks a Google sign-in on its
// way through /auth/callback. signInWithGoogleAction sets it (the OAuth
// redirect URL carries no marker, so it stays byte-identical to the
// Supabase Redirect URLs allowlist entry); the callback route reads it to
// tell a cancelled Google sign-in (`error=google`) from a failed email link
// (`error=link`) and always clears it; the email-flow actions clear it too.
// The cookie path is the callback path (application/sign-up.ts,
// AUTH_CALLBACK_PATH).
export const AUTH_FLOW_COOKIE = "cogni_auth_flow";
export const GOOGLE_AUTH_FLOW = "google";

// Ten minutes: long enough to finish Google's consent screen (account
// picker, 2FA) and come back, short enough that an abandoned attempt
// stops affecting later callbacks soon after.
export const AUTH_FLOW_COOKIE_MAX_AGE_SECONDS = 600;

// True when a Cookie request header carries AUTH_FLOW_COOKIE with the
// Google value. Matches the cookie name exactly, so similar names such as
// `xcogni_auth_flow` never count.
export function isGoogleAuthFlow(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((pair) => {
    const separator = pair.indexOf("=");
    if (separator === -1) return false;
    return (
      pair.slice(0, separator).trim() === AUTH_FLOW_COOKIE &&
      pair.slice(separator + 1).trim() === GOOGLE_AUTH_FLOW
    );
  });
}
