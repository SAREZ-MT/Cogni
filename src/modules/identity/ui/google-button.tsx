import { Button } from "@/shared/ui/button";
import { signInWithGoogleAction } from "../actions";

// Server-rendered form: the action fetches the Google URL and redirects.
export function GoogleButton() {
  return (
    <form action={signInWithGoogleAction}>
      <Button type="submit" variant="outline" size="lg" className="w-full">
        Continuar con Google
      </Button>
    </form>
  );
}
