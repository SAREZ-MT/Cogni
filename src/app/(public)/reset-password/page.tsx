import { ResetPasswordForm } from "@/modules/identity/ui";
import { AuthStack } from "../_components/auth-stack";

// Reached from the email link through /auth/callback?next=/reset-password,
// so the visitor already carries a session here.
export default function ResetPasswordPage() {
  return (
    <AuthStack>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-semibold text-2xl text-fg tracking-tight">
          Elige una contraseña nueva
        </h1>
        <p className="text-fg-secondary text-sm">
          Necesita al menos 8 caracteres.
        </p>
      </div>
      <ResetPasswordForm />
    </AuthStack>
  );
}
