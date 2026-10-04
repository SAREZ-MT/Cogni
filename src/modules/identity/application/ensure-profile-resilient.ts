import type { Profile } from "../domain/profile";
import { type EnsureProfileDeps, ensureProfile } from "./ensure-profile";

export interface EnsureProfileResilientDeps extends EnsureProfileDeps {
  // Invoked when both attempts fail; the caller (identity/index.ts) wires
  // this to its Sentry client, keeping this application-layer module free
  // of an infrastructure dependency.
  onTransientFailure?: (error: unknown) => void;
  retryDelayMs?: number;
}

const DEFAULT_RETRY_DELAY_MS = 150;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runEnsureProfile(
  input: { ownerId: string },
  deps: EnsureProfileDeps,
): Promise<Profile> {
  const result = await ensureProfile(input, deps);
  if (!result.ok) throw result.error;
  return result.value;
}

// Wraps EnsureProfile with one bounded retry and non-throwing degradation
// (specs/identity-auth/spec.md, "Tabla `profiles` con creación
// automática": EnsureProfile "MUST tolerar y recuperarse de un fallo
// transitorio del repositorio... sin dejar al usuario sin perfil ni
// bloquear el acceso al shell en el siguiente intento"). The upsert's own
// `onConflictDoNothing` already covers the concurrent-write race; this
// wrapper covers a distinct failure mode: a transient network/DB error.
// Returns the profile, or null when both attempts failed: callers (the
// terms gate) treat null as "unknown" and fail open.
export async function ensureProfileResilient(
  input: { ownerId: string },
  deps: EnsureProfileResilientDeps,
): Promise<Profile | null> {
  try {
    return await runEnsureProfile(input, deps);
  } catch {
    // First attempt failed transiently; retry once after a short backoff.
  }

  await wait(deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);

  try {
    return await runEnsureProfile(input, deps);
  } catch (error) {
    deps.onTransientFailure?.(error);
    // Never rethrow: the (app) layout must keep rendering. EnsureProfile
    // runs again on the user's next request.
    return null;
  }
}
