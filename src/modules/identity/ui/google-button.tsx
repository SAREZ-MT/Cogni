import { GoogleIcon } from "@/shared/ui/google-icon";
import { SubmitButton } from "@/shared/ui/submit-button";
import { signInWithGoogleAction } from "../actions";

// Server-rendered form: the action fetches the Google URL and redirects.
// SubmitButton reads the form status, so the redirect wait shows a spinner.
// `describedBy` points at the sign-up consent notice next to the button.
export function GoogleButton({ describedBy }: { describedBy?: string } = {}) {
  return (
    <form action={signInWithGoogleAction}>
      <SubmitButton
        variant="outline"
        size="lg"
        className="w-full border-border-default bg-card hover:bg-hover"
        aria-describedby={describedBy}
      >
        <GoogleIcon />
        Continuar con Google
      </SubmitButton>
    </form>
  );
}
