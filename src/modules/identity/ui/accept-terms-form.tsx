"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { acceptTermsAction } from "../actions";
import { IDLE_FORM_STATE } from "./auth-form-state";
import { AuthStatus } from "./auth-status";
import { TERMS_COPY } from "./terms-copy";

// Not `required` on purpose: the server owns the rule (TERMS_NOT_ACCEPTED)
// and answers with the same alert whether JS validation exists or not.
export function AcceptTermsForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(
    acceptTermsAction,
    IDLE_FORM_STATE,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <AuthStatus state={state} />
      <input type="hidden" name="next" value={next} />
      <Checkbox
        name="accept"
        label={TERMS_COPY.accept.checkbox}
        data-testid="terms-accept-checkbox"
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending}
        data-testid="terms-accept-submit"
      >
        {TERMS_COPY.accept.submit}
      </Button>
    </form>
  );
}
