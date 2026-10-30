import { ForgotPasswordForm } from "@/modules/identity/ui";
import { TextLink } from "@/shared/ui/text-link";
import { AuthStack } from "../_components/auth-stack";

export default function ForgotPasswordPage() {
  return (
    <AuthStack>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-semibold text-2xl text-fg tracking-tight">
          Recupera tu contraseña
        </h1>
        <p className="text-fg-secondary text-sm">
          Escribe tu correo y te enviaremos un enlace para crear una nueva.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm">
        <TextLink href="/login">Volver a iniciar sesión</TextLink>
      </p>
    </AuthStack>
  );
}
