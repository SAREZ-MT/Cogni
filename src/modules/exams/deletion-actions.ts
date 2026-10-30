"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { type ActionError, toActionError } from "@/shared/kernel/domain-error";
import { err, type Result } from "@/shared/kernel/result";
import { parseInput, requireOwnerId, withBoundary } from "./action-support";
import {
  deleteExamSet,
  type ExamSetDeletionPreview,
  previewExamSetDeletion,
} from "./application";
import { DrizzleExamSetDeletion } from "./infrastructure";

// Phase 8 H19: "Eliminar examen" of a hub card is a real delete of the page's
// whole exam set (questions, exams, answers, history). The confirmation dialog reads the preview right before the
// user confirms; deleting revalidates the whole app layout (hubs, the
// notebook and page views, Inicio and the calendar all count the set).

const pageInput = z.object({ pageId: z.uuid() });

export async function previewExamSetDeletionAction(
  input: unknown,
): Promise<Result<ExamSetDeletionPreview, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const result = await previewExamSetDeletion(
      parsed.value,
      { deletion: new DrizzleExamSetDeletion(getDb()) },
      ownerId.value,
    );
    return result.ok ? result : err(toActionError(result.error));
  });
}

export async function deleteExamSetAction(
  input: unknown,
): Promise<Result<{ pageId: string }, ActionError>> {
  return withBoundary(async () => {
    const ownerId = await requireOwnerId();
    if (!ownerId.ok) return ownerId;
    const parsed = parseInput(pageInput, input);
    if (!parsed.ok) return parsed;

    const result = await deleteExamSet(
      parsed.value,
      { deletion: new DrizzleExamSetDeletion(getDb()), clock: systemClock },
      ownerId.value,
    );
    if (!result.ok) return err(toActionError(result.error));
    revalidatePath("/", "layout");
    return result;
  });
}
