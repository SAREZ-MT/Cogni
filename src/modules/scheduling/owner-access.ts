import { ownerAccessError, requireOwner } from "@/modules/identity";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SCHEDULING_ERROR } from "./domain/errors";

// The owner gate of this module's reads (Server Actions and the server-only
// page reads behind them): session and current terms, checked by identity
// (requireOwner). No "use server" here: this is a helper, not an entry point.
export async function requireOwnerId(): Promise<Result<string, ActionError>> {
  const access = await requireOwner();
  if (access.status === "granted") return ok(access.ownerId);
  return err(
    toActionError(
      access.reason === "session_required"
        ? new DomainError(
            SCHEDULING_ERROR.SESSION_REQUIRED,
            "Debes iniciar sesión para continuar.",
          )
        : ownerAccessError(access.reason),
    ),
  );
}
