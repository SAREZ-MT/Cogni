"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { clientEnv } from "@/shared/config/env.client";
import { createServerAnalytics } from "@/shared/observability/analytics";
import {
  AUTH_CALLBACK_PATH,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
} from "./application";
import {
  createSupabaseServerClient,
  SupabaseAuthGateway,
} from "./infrastructure";
import { AUTH_COPY, messageForCode } from "./ui/auth-copy";
import type { AuthFormState } from "./ui/auth-form-state";

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
