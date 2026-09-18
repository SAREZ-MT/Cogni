"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "../actions";
import { AuthField } from "./auth-field";
import { IDLE_FORM_STATE } from "./auth-form-state";
import { AuthStatus } from "./auth-status";

export function SignInForm() {
  const [state, action, pending] = useActionState(
    signInAction,
    IDLE_FORM_STATE,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <AuthStatus state={state} />
      <AuthField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <AuthField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        Iniciar sesión
      </Button>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(
    signUpAction,
    IDLE_FORM_STATE,
  );
  if (state.status === "success") return <AuthStatus state={state} />;
  return (
    <form action={action} className="flex flex-col gap-5">
      <AuthStatus state={state} />
      <AuthField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <AuthField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        Crear cuenta
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    IDLE_FORM_STATE,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <AuthStatus state={state} />
      <AuthField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        Enviar enlace
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(
    updatePasswordAction,
    IDLE_FORM_STATE,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <AuthStatus state={state} />
      <AuthField
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        Guardar contraseña
      </Button>
    </form>
  );
}
