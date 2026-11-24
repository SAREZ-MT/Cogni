import { type OwnerAccess, ownerAccessFor } from "../domain/owner-access";
import type { Profile } from "../domain/profile";

export interface ResolveOwnerAccessDeps {
  currentUser(): Promise<{ id: string } | null>;
  // Null when the profile could not be loaded: access is then denied.
  loadProfile(ownerId: string): Promise<Profile | null>;
}

// The session and terms check every Server Action runs before touching data
// (see domain/owner-access.ts). The profile is only read for a signed-in
// user, and a failing profile read denies access instead of throwing.
export async function resolveOwnerAccess(
  deps: ResolveOwnerAccessDeps,
): Promise<OwnerAccess> {
  const user = await deps.currentUser();
  if (!user) return ownerAccessFor(null, null);

  let profile: Profile | null;
  try {
    profile = await deps.loadProfile(user.id);
  } catch {
    profile = null;
  }
  return ownerAccessFor(user, profile);
}
