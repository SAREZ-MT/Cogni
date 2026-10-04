import Link from "next/link";
import {
  AUTH_COPY,
  GoogleButton,
  SignInForm,
  TermsNotice,
} from "@/modules/identity/ui";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl text-fg">Inicia sesión</h1>
        <p className="text-fg-secondary text-sm">
          Bienvenido de vuelta a Cogni.
        </p>
      </div>
      {error === "google" && (
        <output className="rounded-input bg-warning-50 px-3 py-2 text-sm text-warning-600">
          {AUTH_COPY.googleCancelled}
        </output>
      )}
      <SignInForm />
      <GoogleButton />
      <TermsNotice />
      <p className="text-center text-fg-secondary text-sm">
        <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
      </p>
      <p className="text-center text-fg-secondary text-sm">
        ¿No tienes cuenta? <Link href="/register">Crea una</Link>
      </p>
    </div>
  );
}
