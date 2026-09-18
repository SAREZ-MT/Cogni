// Shape every auth Server Action returns to its form (useActionState).
export interface AuthFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export const IDLE_FORM_STATE: AuthFormState = { status: "idle" };
