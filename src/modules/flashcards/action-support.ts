import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getCurrentUser } from "@/modules/identity";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "./domain/errors";

// Shared boundary of this module's Server Action files (actions.ts and
// session-actions.ts): session first, Zod validation, and every failure
// leaves as the plain ActionError shape. No "use server" here: these are
// helpers, not client-reachable entry points.

export const UNEXPECTED_ERROR: ActionError = {
  code: FLASHCARD_ERROR.UNEXPECTED,
  message: "unexpected flashcards action failure",
};

export function actionError(code: string, message: string): ActionError {
  return toActionError(new DomainError(code, message));
}

export async function requireOwnerId(): Promise<Result<string, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return err(
      actionError(
        FLASHCARD_ERROR.SESSION_REQUIRED,
        "Debes iniciar sesión para continuar.",
      ),
    );
  }
  return ok(user.id);
}

export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T, ActionError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return err(
      actionError(FLASHCARD_ERROR.INVALID_INPUT, "Invalid flashcards input"),
    );
  }
  return ok(parsed.data);
}

export async function withBoundary<T, E extends ActionError = ActionError>(
  run: () => Promise<Result<T, E>>,
): Promise<Result<T, E | ActionError>> {
  try {
    return await run();
  } catch (error) {
    Sentry.captureException(error);
    return err(UNEXPECTED_ERROR);
  }
}

// Every flashcards route (decks list, notebook decks, page deck) reads the
// cards; revalidating the segment layout refreshes all of them.
export function revalidateDecks(): void {
  revalidatePath("/flashcards", "layout");
}
