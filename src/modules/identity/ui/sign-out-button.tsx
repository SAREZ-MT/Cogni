"use client";

import { LogOut } from "lucide-react";
import { useActionState } from "react";
import { signOutAction } from "../actions";
import type { AuthFormState } from "./auth-form-state";
import { IDLE_FORM_STATE } from "./auth-form-state";
import { AuthStatus } from "./auth-status";

// signOutAction redirects on success (it never returns in that case) and
// only resolves to an error result when Supabase rejects the sign-out call
// (specs/identity-auth/spec.md, "Cierre de sesión": "MUST NOT dar por
// cerrada la sesión en la UI si Supabase reporta un error").
async function signOutFormAction(
  _previous: AuthFormState,
  _formData: FormData,
): Promise<AuthFormState> {
  const result = await signOutAction();
  if (result) return { status: "error", message: result.message };
  return IDLE_FORM_STATE;
}

export function SignOutButton({ className }: { className?: string }) {
  const [state, action, pending] = useActionState(
    signOutFormAction,
    IDLE_FORM_STATE,
  );
  return (
    <form action={action} className="contents">
      <AuthStatus state={state} />
      <button
        type="submit"
        role="menuitem"
        className={className}
        disabled={pending}
      >
        <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
        Cerrar sesión
      </button>
    </form>
  );
}
