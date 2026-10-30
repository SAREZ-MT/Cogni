import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { AUTH_ERROR } from "../domain/auth-errors";
import type { AuthGateway, SignUpResult } from "../domain/auth-gateway";

type AuthApi = Pick<
  SupabaseClient["auth"],
  | "signUp"
  | "signInWithPassword"
  | "signOut"
  | "resetPasswordForEmail"
  | "updateUser"
  | "signInWithOAuth"
>;

function providerError(message: string): DomainError {
  return new DomainError(AUTH_ERROR.PROVIDER_UNAVAILABLE, message);
}

// Translates Supabase Auth into the AuthGateway port. Error codes come from
// the provider's `error.code`; anything unknown is PROVIDER_UNAVAILABLE.
export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly auth: AuthApi) {}

  async signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
    userMetadata: Record<string, string>;
  }): Promise<Result<SignUpResult, DomainError>> {
    const { data, error } = await this.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: input.emailRedirectTo,
        data: input.userMetadata,
      },
    });
    if (error) {
      if (error.code === "user_already_exists")
        return ok({ outcome: "already_registered", userId: null });
      return err(providerError(error.message));
    }
    // With email confirmation on, an existing email yields an obfuscated
    // user whose identities array is empty (Supabase docs).
    if (data.user && data.user.identities?.length === 0)
      return ok({ outcome: "already_registered", userId: null });
    return ok({ outcome: "verification_sent", userId: data.user?.id ?? null });
  }

  async signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<Result<{ userId: string }, DomainError>> {
    const { data, error } = await this.auth.signInWithPassword(input);
    if (error) {
      if (error.code === "email_not_confirmed") {
        return err(
          new DomainError(AUTH_ERROR.EMAIL_NOT_VERIFIED, "email not verified"),
        );
      }
      if (error.code === "invalid_credentials") {
        return err(
          new DomainError(
            AUTH_ERROR.INVALID_CREDENTIALS,
            "invalid credentials",
          ),
        );
      }
      return err(providerError(error.message));
    }
    // data.user is always present on a successful signInWithPassword
    // response, so the caller (identity/actions.ts) never needs a second
    // auth.getUser() query to learn who just signed in.
    return ok({ userId: data.user.id });
  }

  async signOut(): Promise<Result<void, DomainError>> {
    const { error } = await this.auth.signOut();
    return error ? err(providerError(error.message)) : ok(undefined);
  }

  async requestPasswordReset(input: {
    email: string;
    redirectTo: string;
  }): Promise<Result<void, DomainError>> {
    const { error } = await this.auth.resetPasswordForEmail(input.email, {
      redirectTo: input.redirectTo,
    });
    return error ? err(providerError(error.message)) : ok(undefined);
  }

  async updatePassword(input: {
    password: string;
  }): Promise<Result<void, DomainError>> {
    const { error } = await this.auth.updateUser({ password: input.password });
    return error ? err(providerError(error.message)) : ok(undefined);
  }

  async startGoogleSignIn(input: {
    redirectTo: string;
  }): Promise<Result<{ url: string }, DomainError>> {
    const { data, error } = await this.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: input.redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url)
      return err(providerError(error?.message ?? "no oauth url"));
    return ok({ url: data.url });
  }
}
