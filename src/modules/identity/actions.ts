"use server";

import { redirect } from "next/navigation";
import { clientEnv } from "@/shared/config/env.client";
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
  if (result.value === "already_registered") {
    return { status: "error", message: AUTH_COPY.alreadyRegistered };
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
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const auth = await gateway();
  await auth.signOut();
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
