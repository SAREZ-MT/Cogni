import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";

export type SignUpOutcome = "verification_sent" | "already_registered";

// Port over the identity provider (Supabase Auth in infrastructure).
// Every method translates provider failures into a DomainError with an
// AUTH_ERROR code; nothing provider-specific crosses this boundary.
export interface AuthGateway {
  signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<Result<SignUpOutcome, DomainError>>;
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<Result<void, DomainError>>;
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
