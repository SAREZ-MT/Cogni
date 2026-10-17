import { GoogleButton, SignUpForm, TermsNotice } from "@/modules/identity/ui";
import { TextDivider } from "@/shared/ui/text-divider";
import { TextLink } from "@/shared/ui/text-link";
import { AuthStack } from "../_components/auth-stack";

export default function RegisterPage() {
  return (
    <AuthStack>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-semibold text-2xl text-fg tracking-tight">
          Crea tu cuenta
        </h1>
        <p className="text-fg-secondary text-sm">
          Empieza a estudiar con IA en minutos. Te enviaremos un correo para
          verificarla.
        </p>
      </div>
      <SignUpForm />
      <div className="flex flex-col gap-4">
        <TextDivider>o</TextDivider>
        <GoogleButton />
        <TermsNotice variant="sign-up" />
      </div>
      <p className="border-border-default border-t pt-6 text-center text-fg-secondary text-sm">
        ¿Ya tienes cuenta? <TextLink href="/login">Inicia sesión</TextLink>
      </p>
    </AuthStack>
  );
}
