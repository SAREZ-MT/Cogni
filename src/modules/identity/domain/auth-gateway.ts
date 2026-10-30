import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";

export type SignUpOutcome = "verification_sent" | "already_registered";

// userId is null for already_registered: no id to correlate, none to leak.
export interface SignUpResult {
  outcome: SignUpOutcome;
  userId: string | null;
}

// Port over the identity provider (Supabase Auth in infrastructure).
// Every method translates provider failures into a DomainError with an
// AUTH_ERROR code; nothing provider-specific crosses this boundary.
export interface AuthGateway {
  // `userMetadata` is stored on the new account by the provider; sign-up
  // uses it for the server-side consent proof (domain/terms-consent.ts).
  signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
    userMetadata: Record<string, string>;
  }): Promise<Result<SignUpResult, DomainError>>;
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<Result<{ userId: string }, DomainError>>;
  signOut(): Promise<Result<void, DomainError>>;
  requestPasswordReset(input: {
    email: string;
    redirectTo: string;
  }): Promise<Result<void, DomainError>>;
  updatePassword(input: {
    password: string;
  }): Promise<Result<void, DomainError>>;
  startGoogleSignIn(input: {
    redirectTo: string;
  }): Promise<Result<{ url: string }, DomainError>>;
}
