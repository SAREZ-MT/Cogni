import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { AUTH_ERROR } from "../../domain/auth-errors";
import type { AuthGateway, SignUpResult } from "../../domain/auth-gateway";

type FakeUser = { email: string; password: string; verified: boolean };

// Scriptable AuthGateway double. It records every call so use cases can be
// checked for what they forward, and it enforces the same rules the real
// provider does: unverified users cannot sign in, unknown emails never leak.
export class FakeAuthGateway implements AuthGateway {
  readonly users: FakeUser[] = [];
  readonly calls: { method: keyof AuthGateway; input: unknown }[] = [];
  signedIn: string | null = null;
  googleUrl = "https://accounts.google.com/o/oauth2/auth?state=fake";

  seed(user: FakeUser): void {
    this.users.push(user);
  }

  async signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<Result<SignUpResult, DomainError>> {
    this.calls.push({ method: "signUp", input });
    if (this.users.some((user) => user.email === input.email)) {
      return ok({ outcome: "already_registered", userId: null });
    }
    this.users.push({
      email: input.email,
      password: input.password,
      verified: false,
    });
    return ok({
      outcome: "verification_sent",
      userId: `fake-user-${this.users.length}`,
    });
  }

  async signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<Result<void, DomainError>> {
    this.calls.push({ method: "signInWithPassword", input });
    const user = this.users.find(
      (candidate) => candidate.email === input.email,
    );
    if (!user || user.password !== input.password) {
      return err(
        new DomainError(AUTH_ERROR.INVALID_CREDENTIALS, "invalid credentials"),
      );
    }
    if (!user.verified) {
      return err(
        new DomainError(AUTH_ERROR.EMAIL_NOT_VERIFIED, "email not verified"),
      );
    }
    this.signedIn = user.email;
    return ok(undefined);
  }

  async signOut(): Promise<Result<void, DomainError>> {
    this.calls.push({ method: "signOut", input: undefined });
    this.signedIn = null;
    return ok(undefined);
  }

  async requestPasswordReset(input: {
    email: string;
    redirectTo: string;
  }): Promise<Result<void, DomainError>> {
    this.calls.push({ method: "requestPasswordReset", input });
    return ok(undefined);
  }

  async updatePassword(input: {
    password: string;
  }): Promise<Result<void, DomainError>> {
    this.calls.push({ method: "updatePassword", input });
    return ok(undefined);
  }

  async startGoogleSignIn(input: {
    redirectTo: string;
  }): Promise<Result<{ url: string }, DomainError>> {
    this.calls.push({ method: "startGoogleSignIn", input });
    return ok({ url: this.googleUrl });
  }
}
