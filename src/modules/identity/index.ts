import "server-only";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { ensureProfile } from "./application";
import {
  createSupabaseServerClient,
  DrizzleProfileRepository,
  type SessionUser,
} from "./infrastructure";

// Server-side public API of the identity module (layouts, route handlers).
// Client code uses ./actions (Server Actions) and ./ui (components) instead:
// this file pulls server-only modules and cannot enter a client bundle.
export { safeNext } from "./application";
export type { SessionUser };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

// First authenticated request of a session: creates the profiles row if
// missing. Idempotent, so it is safe to call from the (app) layout.
export async function ensureProfileForUser(ownerId: string): Promise<void> {
  const result = await ensureProfile(
    { ownerId },
    { profiles: new DrizzleProfileRepository(getDb()), clock: systemClock },
  );
  if (!result.ok) throw result.error;
}

// OAuth and email-link callback: trades the PKCE code for session cookies.
export async function exchangeCodeForSession(code: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return !error;
}
