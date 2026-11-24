import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { ownerAccessError, requireOwner } from "@/modules/identity";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "./domain/errors";

// Shared boundary of this module's Server Action files: session first, Zod
// validation, and every failure leaves as the plain ActionError shape. No
// "use server" here: these are helpers, not client-reachable entry points.
// Same shape as flashcards/action-support.ts, duplicated on purpose:
// src/shared cannot depend on the identity module, and modules only reach
// each other through their index.

export const UNEXPECTED_ERROR: ActionError = {
  code: EXAM_ERROR.UNEXPECTED,
  message: "unexpected exams action failure",
};

// Session and current terms, checked by identity (requireOwner): the (app)
// layout gate does not cover a Server Action called directly.
export async function requireOwnerId(): Promise<Result<string, ActionError>> {
  const access = await requireOwner();
  if (access.status === "granted") return ok(access.ownerId);
  if (access.reason === "session_required") {
    return err(
      toActionError(
        new DomainError(
          EXAM_ERROR.SESSION_REQUIRED,
          "Debes iniciar sesión para continuar.",
        ),
      ),
    );
  }
  return err(toActionError(ownerAccessError(access.reason)));
}

export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T, ActionError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return err(
      toActionError(
        new DomainError(EXAM_ERROR.INVALID_INPUT, "Invalid exams input"),
      ),
    );
  }
  return ok(parsed.data);
}

export async function withBoundary<T>(
  run: () => Promise<Result<T, ActionError>>,
): Promise<Result<T, ActionError>> {
  try {
    return await run();
  } catch (error) {
    Sentry.captureException(error);
    return err(UNEXPECTED_ERROR);
  }
}

// Every exams route reads the questions; revalidating the segment layout
// refreshes all of them.
export function revalidateExams(): void {
  revalidatePath("/exams", "layout");
}
