"use server";

import * as Sentry from "@sentry/nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { clientEnv } from "@/shared/config/env.client";
import { systemClock } from "@/shared/kernel/clock";
import { createServerAnalytics } from "@/shared/observability/analytics";
import {
  AUTH_CALLBACK_PATH,
  acceptTerms,
  adoptBrowserTimeZone,
  requestPasswordReset,
  safeNext,
  signIn,
  signUp,
  updatePassword,
  updateProfileTimeZone,
} from "./application";
import {
  AUTH_FLOW_COOKIE,
  AUTH_FLOW_COOKIE_MAX_AGE_SECONDS,
  GOOGLE_AUTH_FLOW,
} from "./domain/auth-flow";
import { TERMS_VERSION } from "./domain/terms";
import {
  consentCookieValue,
  TERMS_CONSENT_COOKIE,
  TERMS_CONSENT_COOKIE_MAX_AGE_SECONDS,
} from "./domain/terms-consent";
import { PROFILE_ERROR } from "./domain/time-zone";
import {
  createSupabaseServerClient,
  DrizzleProfileRepository,
  SupabaseAuthGateway,
} from "./infrastructure";
import { AUTH_COPY, messageForCode } from "./ui/auth-copy";
import type { AuthFormState } from "./ui/auth-form-state";
import { TIME_ZONE_COPY } from "./ui/time-zone-copy";
import type { TimeZoneFormState } from "./ui/time-zone-form-state";

// Server Actions are the only entry point for the public auth forms. Each
// one validates through the application layer and maps the result to a
// form state the client components render. Redirects happen here.

async function gateway(): Promise<SupabaseAuthGateway> {
  const supabase = await createSupabaseServerClient();
  return new SupabaseAuthGateway(supabase.auth);
}

// Validated at boot: a deploy without NEXT_PUBLIC_SITE_URL fails loudly
// instead of sending verification links that point at localhost.
function siteUrl(): string {
  return clientEnv().NEXT_PUBLIC_SITE_URL;
}

function analytics() {
  const env = clientEnv();
  return createServerAnalytics({
    key: env.NEXT_PUBLIC_POSTHOG_KEY,
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}

// An email flow (verification or password reset) clears any Google flow
// marker and consent-intent cookie left by an abandoned Google attempt, so
// a later failed email link is not reported as a cancelled Google sign-in
// and a stale Google consent never reaches the callback. Same names and
// path as the setters in signInWithGoogleAction (cookies().delete() would
// use path "/" and miss a cookie scoped to the callback path).
async function clearGoogleFlowCookie(): Promise<void> {
  const store = await cookies();
  for (const name of [AUTH_FLOW_COOKIE, TERMS_CONSENT_COOKIE]) {
    store.set(name, "", { path: AUTH_CALLBACK_PATH, maxAge: 0 });
  }
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await clearGoogleFlowCookie();
  const result = await signUp(Object.fromEntries(formData), {
    auth: await gateway(),
    siteUrl: siteUrl(),
    clock: systemClock,
  });
  if (!result.ok)
    return { status: "error", message: messageForCode(result.error.code) };
  if (result.value.outcome === "already_registered") {
    return { status: "error", message: AUTH_COPY.alreadyRegistered };
  }
  // Deferred past the response: analytics never delays or fails auth.
  // The consent was given here (sign-in-wrap notice), so this is its one
  // terms_accepted event; the callback that later stamps the profile from
  // the metadata does not emit another.
  const userId = result.value.userId;
  if (userId) {
    after(() => {
      const events = analytics();
      events.track("user_signed_up", userId);
      events.track("terms_accepted", userId, {
        version: TERMS_VERSION,
        source: "signup",
      });
    });
  }
  return { status: "success", message: AUTH_COPY.verificationSent };
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = await signIn(Object.fromEntries(formData), {
    auth: await gateway(),
  });
  if (!result.ok)
    return { status: "error", message: messageForCode(result.error.code) };
  // The gateway already exposes userId from the sign-in response, so
  // signInAction never needs a second auth.getUser() query to learn who
  // just signed in (specs/identity-auth/spec.md, "Sesión por cookies con
  // refresco en middleware").
  const { userId } = result.value;
  after(() => analytics().track("user_signed_in", userId));
  redirect("/inicio");
}

export async function signOutAction(): Promise<
  { status: "error"; message: string } | undefined
> {
  const auth = await gateway();
  const result = await auth.signOut();
  if (!result.ok)
    return { status: "error", message: messageForCode(result.error.code) };
  redirect("/login");
}

export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await clearGoogleFlowCookie();
  const result = await requestPasswordReset(Object.fromEntries(formData), {
    auth: await gateway(),
    siteUrl: siteUrl(),
  });
  if (!result.ok)
    return { status: "error", message: messageForCode(result.error.code) };
  return { status: "success", message: AUTH_COPY.resetSent };
}

export async function updatePasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = await updatePassword(Object.fromEntries(formData), {
    auth: await gateway(),
  });
  if (!result.ok)
    return { status: "error", message: messageForCode(result.error.code) };
  redirect("/inicio");
}

// The callback URL stays exactly `${siteUrl()}/auth/callback`: Supabase
// matches redirectTo against its Redirect URLs allowlist, and a query
// marker would stop an exact entry from matching (Google sign-in would
// silently fall back to the Site URL). The Google flow is marked instead
// with a short-lived httpOnly cookie scoped to the callback path, which
// app/auth/callback/route.ts reads to show the Google copy (not the
// invalid-link one) on a failed exchange, and always clears.
export async function signInWithGoogleAction(): Promise<void> {
  const auth = await gateway();
  const result = await auth.startGoogleSignIn({
    redirectTo: `${siteUrl()}${AUTH_CALLBACK_PATH}`,
  });
  if (!result.ok) redirect("/login?error=google");
  const store = await cookies();
  const callbackCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: AUTH_CALLBACK_PATH,
  } as const;
  store.set(AUTH_FLOW_COOKIE, GOOGLE_AUTH_FLOW, {
    ...callbackCookie,
    maxAge: AUTH_FLOW_COOKIE_MAX_AGE_SECONDS,
  });
  // Clicking "Continuar con Google" next to the sign-in-wrap notice is the
  // acceptance for an account created in this round trip: the server time
  // and terms version travel to /auth/callback, which stamps a brand-new
  // profile only (domain/terms-consent.ts).
  store.set(TERMS_CONSENT_COOKIE, consentCookieValue(systemClock.now()), {
    ...callbackCookie,
    maxAge: TERMS_CONSENT_COOKIE_MAX_AGE_SECONDS,
  });
  redirect(result.value.url);
}

// Terms gate form (fallback for existing accounts and version bumps; new
// accounts accept at sign-up): `accept` is the checkbox ("on" when ticked),
// `next` the path the gate interrupted. Needs a session; anonymous callers
// go to login.
export async function acceptTermsAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Loaded lazily: the db client is server-only, and client components
  // import this file's action references (their tests resolve it eagerly).
  const { getDb } = await import("@/shared/db/client");
  const result = await acceptTerms(
    { accepted: formData.get("accept") === "on" },
    { profiles: new DrizzleProfileRepository(getDb()), clock: systemClock },
    user.id,
  );
  if (!result.ok)
    return { status: "error", message: messageForCode(result.error.code) };

  const version = result.value.termsAcceptedVersion;
  after(() =>
    analytics().track("terms_accepted", user.id, { version, source: "gate" }),
  );
  const next = formData.get("next");
  return redirect(safeNext(typeof next === "string" ? next : null));
}

async function sessionUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function profileDeps() {
  // Lazy for the same reason as acceptTermsAction: the db client is
  // server-only and client components import this file's references.
  const { getDb } = await import("@/shared/db/client");
  return {
    profiles: new DrizzleProfileRepository(getDb()),
    clock: systemClock,
  };
}

// Form copy per time-zone use-case error. Only an invalid zone has its own
// copy; a missing profile (lazy creation raced or failed) or a profile
// creation error from ensureProfile is a save failure for the user, like any
// other. `code` stays a plain DomainError code: the use case can also return
// createProfile's codes, so the PROFILE_ERROR union would not cover it.
function timeZoneErrorMessage(code: string): string {
  return code === PROFILE_ERROR.INVALID_TIME_ZONE
    ? TIME_ZONE_COPY.invalid
    : TIME_ZONE_COPY.failed;
}

// Configuración › Zona horaria form: `timeZone` is the selected IANA name.
// Never throws: unexpected failures go to Sentry and back as copy.
export async function updateTimeZoneAction(
  _previous: TimeZoneFormState,
  formData: FormData,
): Promise<TimeZoneFormState> {
  try {
    const ownerId = await sessionUserId();
    if (!ownerId) {
      return { status: "error", message: TIME_ZONE_COPY.sessionRequired };
    }
    const result = await updateProfileTimeZone(
      { ownerId, timeZone: formData.get("timeZone") },
      await profileDeps(),
    );
    if (!result.ok) {
      return {
        status: "error",
        message: timeZoneErrorMessage(result.error.code),
      };
    }
    return {
      status: "success",
      message: TIME_ZONE_COPY.saved,
      timeZone: result.value.timezone,
    };
  } catch (error) {
    Sentry.captureException(error);
    return { status: "error", message: TIME_ZONE_COPY.failed };
  }
}

// First-use browser detection (TimeZoneAutoDetect): saves the browser's
// zone only while the profile has none. Silent by design — the shell never
// shows feedback for it — so it only answers whether it went through.
export async function adoptBrowserTimeZoneAction(
  timeZone: string,
): Promise<{ ok: true; adopted: boolean } | { ok: false }> {
  try {
    const ownerId = await sessionUserId();
    if (!ownerId) return { ok: false };
    const result = await adoptBrowserTimeZone(
      { ownerId, timeZone },
      await profileDeps(),
    );
    return result.ok
      ? { ok: true, adopted: result.value.adopted }
      : { ok: false };
  } catch (error) {
    Sentry.captureException(error);
    return { ok: false };
  }
}
