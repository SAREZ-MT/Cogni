import { DomainError } from "../domain-error";

// Stand-in for the identity module's owner gate in tests that mock
// "@/modules/identity" and drive the session through a `getCurrentUser`
// mock: a signed-in user is an owner in good standing (current terms
// accepted), no user is a missing session, and a user carrying `denied`
// is refused for that reason (pending terms, unverifiable profile).
type MockedDenial = "terms_required" | "profile_unavailable";
type MockedUser = { id: string; denied?: MockedDenial } | null;
type MockedOwnerAccess =
  | { status: "granted"; ownerId: string }
  | { status: "denied"; reason: "session_required" | MockedDenial };

export function requireOwnerFrom(
  getCurrentUser: () => Promise<MockedUser> | MockedUser,
): () => Promise<MockedOwnerAccess> {
  return async () => {
    const user = await getCurrentUser();
    if (!user) return { status: "denied", reason: "session_required" };
    if (user.denied) return { status: "denied", reason: user.denied };
    return { status: "granted", ownerId: user.id };
  };
}

// Same codes as identity's ACCESS_ERROR (shared code cannot import a
// module); identity's owner-access test keeps the two in step.
export function mockOwnerAccessError(reason: MockedDenial): DomainError {
  return new DomainError(
    reason === "terms_required"
      ? "IDENTITY_TERMS_REQUIRED"
      : "IDENTITY_PROFILE_UNAVAILABLE",
    reason,
  );
}

// The exports of "@/modules/identity" a module's Server Actions use for the
// owner gate, ready to spread into a vi.mock factory.
export function identityOwnerMock(
  getCurrentUser: () => Promise<MockedUser> | MockedUser,
) {
  return {
    requireOwner: requireOwnerFrom(getCurrentUser),
    ownerAccessError: mockOwnerAccessError,
  };
}
