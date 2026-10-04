import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import type { Flashcard } from "../domain";
import type { FlashcardRepository } from "../domain/flashcard-repository";

// The repository scopes by owner, so another owner's page lists as empty.
export async function listFlashcardsByPage(
  input: { pageId: string },
  deps: { flashcards: FlashcardRepository },
  ownerId: string,
): Promise<Result<Flashcard[], DomainError>> {
  return ok(await deps.flashcards.listByPage(input.pageId, ownerId));
}
