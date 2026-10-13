"use server";

import * as Sentry from "@sentry/nextjs";
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

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = await signUp(Object.fromEntries(formData), {
    auth: await gateway(),
    siteUrl: siteUrl(),
  });
  if (!result.ok)
    return { status: "error", message: messageForCode(result.error.code) };
  if (result.value.outcome === "already_registered") {
    return { status: "error", message: AUTH_COPY.alreadyRegistered };
  }
  // Deferred past the response: analytics never delays or fails auth.
  const userId = result.value.userId;
  if (userId) after(() => analytics().track("user_signed_up", userId));
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
  redirect("/");
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
  redirect("/");
}

export async function signInWithGoogleAction(): Promise<void> {
  const auth = await gateway();
  const result = await auth.startGoogleSignIn({
    redirectTo: `${siteUrl()}${AUTH_CALLBACK_PATH}`,
  });
  if (!result.ok) redirect("/login?error=google");
  redirect(result.value.url);
}

// Terms gate form: `accept` is the checkbox ("on" when ticked), `next` the
// path the gate interrupted. Needs a session; anonymous callers go to login.
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
  after(() => analytics().track("terms_accepted", user.id, { version }));
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

// Form copy per time-zone use-case error. A missing profile (lazy creation
// raced or failed) is a save failure for the user, like any other.
function timeZoneErrorMessage(code: string): string {
  switch (code) {
    case PROFILE_ERROR.INVALID_TIME_ZONE:
      return TIME_ZONE_COPY.invalid;
    case PROFILE_ERROR.NOT_FOUND:
      return TIME_ZONE_COPY.failed;
    default:
      return TIME_ZONE_COPY.failed;
  }
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
