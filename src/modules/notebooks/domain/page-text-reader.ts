import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";

// Read-only view of a page's text for other modules (flashcards generation).
// NOT_FOUND when the page does not exist, belongs to another owner or is
// archived.
export interface PageText {
  title: string;
  plainText: string;
}

export interface PageTextReader {
  getPageText(
    pageId: string,
    ownerId: string,
  ): Promise<Result<PageText, DomainError>>;
}
