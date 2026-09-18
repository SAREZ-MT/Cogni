import type { AuthFormState } from "./auth-form-state";

// Announces the action outcome. Errors interrupt (alert); success is polite.
export function AuthStatus({ state }: { state: AuthFormState }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded-input bg-error-50 px-3 py-2 text-error-600 text-sm"
          : "rounded-input bg-success-50 px-3 py-2 text-sm text-success-600"
      }
    >
      {state.message}
    </p>
  );
}
