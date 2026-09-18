import Link from "next/link";
import { ForgotPasswordForm } from "@/modules/identity/ui";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl text-fg">
          Recupera tu contraseña
        </h1>
        <p className="text-fg-secondary text-sm">
          Escribe tu correo y te enviaremos un enlace para crear una nueva.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-fg-secondary text-sm">
        <Link href="/login">Volver a iniciar sesión</Link>
      </p>
    </div>
  );
}
