// Stand-in for the identity module's `requireOwner` in tests that mock
// "@/modules/identity" and drive the session through a `getCurrentUser`
// mock: a signed-in user is an owner in good standing (current terms
// accepted), no user is a missing session. The denials for pending terms or
// an unverifiable profile are covered by each module's action-support test.
type MockedOwnerAccess =
  | { status: "granted"; ownerId: string }
  | { status: "denied"; reason: "session_required" };

export function requireOwnerFrom(
  getCurrentUser: () => Promise<{ id: string } | null> | { id: string } | null,
): () => Promise<MockedOwnerAccess> {
  return async () => {
    const user = await getCurrentUser();
    return user
      ? { status: "granted", ownerId: user.id }
      : { status: "denied", reason: "session_required" };
  };
}
