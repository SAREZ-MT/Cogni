import "server-only";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { ensureProfileResilient } from "./application";
import type { Profile } from "./domain";
import {
  createSupabaseServerClient,
  DrizzleProfileRepository,
  type SessionUser,
} from "./infrastructure";

// Server-side public API of the identity module (layouts, route handlers).
// Client code uses ./actions (Server Actions) and ./ui (components) instead:
// this file pulls server-only modules and cannot enter a client bundle.
export { safeNext } from "./application";
export {
  hasAcceptedCurrentTerms,
  TERMS_PATH,
  TERMS_VERSION,
  termsRedirectFor,
} from "./domain";
export type { Profile, SessionUser };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

// First authenticated request of a session: creates the profiles row if
// missing. Idempotent, so it is safe to call from the (app) layout.
// Resilient to one transient repository failure (retries once, then
// degrades to a Sentry report instead of blocking the shell — see
// ensureProfileResilient in application/).
// Returns the profile (the terms gate reads it) or null on a transient
// failure.
export async function ensureProfileForUser(
  ownerId: string,
): Promise<Profile | null> {
  return ensureProfileResilient(
    { ownerId },
    {
      profiles: new DrizzleProfileRepository(getDb()),
      clock: systemClock,
      onTransientFailure: (error) => Sentry.captureException(error),
    },
  );
}

// OAuth and email-link callback: trades the PKCE code for session cookies.
// Returns the userId from the response instead of the boolean the caller
// used to get, so a Google sign-in callback can emit `user_signed_in`
// without a second auth query (same discipline as `signInAction`).
export async function exchangeCodeForSession(
  code: string,
): Promise<{ ok: boolean; userId: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  return { ok: !error, userId: data.user?.id ?? null };
}
