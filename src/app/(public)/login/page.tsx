import {
  AUTH_COPY,
  GoogleButton,
  SignInForm,
  TermsNotice,
} from "@/modules/identity/ui";
import { TextDivider } from "@/shared/ui/text-divider";
import { TextLink } from "@/shared/ui/text-link";
import { AuthStack } from "../_components/auth-stack";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <AuthStack>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-semibold text-2xl text-fg tracking-tight">
          Inicia sesión
        </h1>
        <p className="text-fg-secondary text-sm">
          Bienvenido de vuelta a Cogni.
        </p>
      </div>
      {error === "google" && (
        <output className="block rounded-input bg-warning-50 px-3 py-2 text-sm text-warning-700">
          {AUTH_COPY.googleCancelled}
        </output>
      )}
      {error === "link" && (
        <output className="block rounded-input bg-warning-50 px-3 py-2 text-sm text-warning-700">
          {AUTH_COPY.linkInvalid}
        </output>
      )}
      <SignInForm />
      <div className="flex flex-col gap-4">
        <TextDivider>o</TextDivider>
        <GoogleButton />
        <TermsNotice />
      </div>
      <p className="text-center text-sm">
        <TextLink href="/forgot-password">¿Olvidaste tu contraseña?</TextLink>
      </p>
      <p className="border-border-default border-t pt-6 text-center text-fg-secondary text-sm">
        ¿No tienes cuenta? <TextLink href="/register">Crea una</TextLink>
      </p>
    </AuthStack>
  );
}
