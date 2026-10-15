import { GoogleIcon } from "@/shared/ui/google-icon";
import { SubmitButton } from "@/shared/ui/submit-button";
import { signInWithGoogleAction } from "../actions";

// Server-rendered form: the action fetches the Google URL and redirects.
// SubmitButton reads the form status, so the redirect wait shows a spinner.
export function GoogleButton() {
  return (
    <form action={signInWithGoogleAction}>
      <SubmitButton
        variant="outline"
        size="lg"
        className="w-full border-border-default bg-card hover:bg-neutral-100"
      >
        <GoogleIcon />
        Continuar con Google
      </SubmitButton>
    </form>
  );
}
