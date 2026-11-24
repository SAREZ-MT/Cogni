import { DomainError } from "@/shared/kernel/domain-error";
import type { Profile } from "./profile";
import { hasAcceptedCurrentTerms } from "./terms";

// Who may run a Server Action. The (app) layout gate only covers rendered
// routes: a Server Action is a public POST endpoint, so every action asks
// again. Unlike the layout (which fails open on a profile it could not
// load, to keep the shell up during an outage), this check fails closed: no
// write or AI call runs for an account whose terms acceptance is unknown.

export type OwnerAccessDenial =
  | "session_required"
  | "terms_required"
  | "profile_unavailable";

export type OwnerAccess =
  | { status: "granted"; ownerId: string }
  | { status: "denied"; reason: OwnerAccessDenial };

export const ACCESS_ERROR = {
  TERMS_REQUIRED: "IDENTITY_TERMS_REQUIRED",
  PROFILE_UNAVAILABLE: "IDENTITY_PROFILE_UNAVAILABLE",
} as const;

export function ownerAccessFor(
  user: { id: string } | null,
  profile: Profile | null,
): OwnerAccess {
  if (!user) return { status: "denied", reason: "session_required" };
  if (!profile || profile.id !== user.id) {
    return { status: "denied", reason: "profile_unavailable" };
  }
  if (!hasAcceptedCurrentTerms(profile)) {
    return { status: "denied", reason: "terms_required" };
  }
  return { status: "granted", ownerId: user.id };
}

// The error of the two denials every module reports the same way. A missing
// session keeps each module's own SESSION_REQUIRED code (its screens map it).
export function ownerAccessError(
  reason: Exclude<OwnerAccessDenial, "session_required">,
): DomainError {
  return reason === "terms_required"
    ? new DomainError(
        ACCESS_ERROR.TERMS_REQUIRED,
        "Debes aceptar los términos vigentes para continuar.",
      )
    : new DomainError(
        ACCESS_ERROR.PROFILE_UNAVAILABLE,
        "No pudimos verificar tu cuenta. Inténtalo de nuevo.",
      );
}
