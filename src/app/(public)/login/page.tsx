import {
  AUTH_COPY,
  GoogleButton,
  SignInForm,
  SignUpConsentNotice,
} from "@/modules/identity/ui";
import { TextDivider } from "@/shared/ui/text-divider";
import { TextLink } from "@/shared/ui/text-link";
import { AuthStack } from "../_components/auth-stack";

const CONSENT_NOTICE_ID = "sign-up-consent";

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
        {/* Google can create an account from here too: the notice covers it. */}
        <GoogleButton describedBy={CONSENT_NOTICE_ID} />
        <SignUpConsentNotice variant="login" id={CONSENT_NOTICE_ID} />
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
