// When a session may set a new password without proving the current one.
// The only screen that changes a password is the reset page, reached from
// the recovery email link, so the session must have been opened by that
// link, recently. A session from a password or Google sign-in (for example
// a stolen session cookie) cannot change the password.

// One sign-in step of the current session, as the provider's signed token
// reports it (its `amr` claim).
export interface AuthenticationEvent {
  method: string;
  at: Date;
}

export const RECOVERY_METHOD = "recovery";
// How long after the recovery link was used the new password is accepted.
export const RECOVERY_WINDOW_MS = 60 * 60 * 1000;
// Clock skew allowed between this server and the provider.
const SKEW_MS = 60_000;

export function isFreshRecoverySession(
  events: readonly AuthenticationEvent[],
  now: Date,
): boolean {
  let latest: AuthenticationEvent | null = null;
  for (const event of events) {
    if (!latest || event.at.getTime() > latest.at.getTime()) latest = event;
  }
  if (!latest || latest.method !== RECOVERY_METHOD) return false;
  const age = now.getTime() - latest.at.getTime();
  return age >= -SKEW_MS && age <= RECOVERY_WINDOW_MS;
}
