import { ResetPasswordForm } from "@/modules/identity/ui";

// Reached from the email link through /auth/callback?next=/reset-password,
// so the visitor already carries a session here.
export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl text-fg">
          Elige una contraseña nueva
        </h1>
        <p className="text-fg-secondary text-sm">
          Necesita al menos 8 caracteres.
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
