import {
  GoogleButton,
  SignUpConsentNotice,
  SignUpForm,
} from "@/modules/identity/ui";
import { TextDivider } from "@/shared/ui/text-divider";
import { TextLink } from "@/shared/ui/text-link";
import { AuthStack } from "../_components/auth-stack";

const CONSENT_NOTICE_ID = "sign-up-consent";

// The consent notice sits between the two account-creating buttons (the
// form's submit is its last element, the "o" divider and Google follow), so
// it is adjacent to both and both point at it through aria-describedby.
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
      <SignUpForm describedBy={CONSENT_NOTICE_ID} />
      <div className="flex flex-col gap-4">
        <SignUpConsentNotice variant="register" id={CONSENT_NOTICE_ID} />
        <TextDivider>o</TextDivider>
        <GoogleButton describedBy={CONSENT_NOTICE_ID} />
      </div>
      <p className="border-border-default border-t pt-6 text-center text-fg-secondary text-sm">
        ¿Ya tienes cuenta? <TextLink href="/login">Inicia sesión</TextLink>
      </p>
    </AuthStack>
  );
}
