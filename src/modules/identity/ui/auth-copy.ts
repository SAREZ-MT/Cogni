import { AUTH_ERROR } from "../domain/auth-errors";

// Every user-facing auth message lives here: Spanish, "tú", actionable.
export const AUTH_COPY = {
  invalidInput:
    "Revisa el correo y la contraseña: la contraseña necesita al menos 8 caracteres.",
  invalidCredentials: "El correo o la contraseña no son correctos.",
  emailNotVerified:
    "Aún no has verificado tu correo. Revisa tu bandeja de entrada para continuar.",
  providerUnavailable:
    "No pudimos completar la acción. Inténtalo de nuevo en unos minutos.",
  alreadyRegistered: "El email ya está registrado. ¿Quieres iniciar sesión?",
  verificationSent:
    "Te enviamos un correo de verificación. Revisa tu bandeja para continuar.",
  resetSent:
    "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
  termsNotAccepted: "Debes aceptar los términos para continuar.",
  googleCancelled:
    "No se completó el acceso con Google. Puedes intentarlo de nuevo.",
  linkInvalid: "El enlace no es válido o ya venció. Pide uno nuevo.",
} as const;

export function messageForCode(code: string): string {
  switch (code) {
    case AUTH_ERROR.INVALID_INPUT:
      return AUTH_COPY.invalidInput;
    case AUTH_ERROR.INVALID_CREDENTIALS:
      return AUTH_COPY.invalidCredentials;
    case AUTH_ERROR.EMAIL_NOT_VERIFIED:
      return AUTH_COPY.emailNotVerified;
    case AUTH_ERROR.TERMS_NOT_ACCEPTED:
      return AUTH_COPY.termsNotAccepted;
    default:
      return AUTH_COPY.providerUnavailable;
  }
}
