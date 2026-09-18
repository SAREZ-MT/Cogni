import Link from "next/link";
import { GoogleButton, SignUpForm } from "@/modules/identity/ui";

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl text-fg">Crea tu cuenta</h1>
        <p className="text-fg-secondary text-sm">
          Te enviaremos un correo para verificarla.
        </p>
      </div>
      <SignUpForm />
      <GoogleButton />
      <p className="text-center text-fg-secondary text-sm">
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </div>
  );
}
