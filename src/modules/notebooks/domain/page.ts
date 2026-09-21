import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import { validateTitle } from "./notebook";
import type { TiptapDoc } from "./plain-text";

export const DEFAULT_PAGE_TITLE = "Sin título";

// A brand-new page's content: an empty Tiptap document (specs/notebooks/spec.md).
export const EMPTY_DOC: TiptapDoc = { type: "doc", content: [] };

export interface Page {
  readonly id: string;
  readonly ownerId: string;
  readonly notebookId: string;
  readonly title: string;
  readonly content: TiptapDoc;
  readonly plainText: string;
  readonly contentVersion: number;
  readonly position: number;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewPage {
  id: string;
  ownerId: string;
  notebookId: string;
  title?: string;
  position: number;
}

export function createPage(
  input: NewPage,
  clock: Clock,
): Result<Page, DomainError> {
  const title = validateTitle(input.title ?? DEFAULT_PAGE_TITLE);
  if (!title.ok) return title;

  const now = clock.now();
  return ok({
    id: input.id,
    ownerId: input.ownerId,
    notebookId: input.notebookId,
    title: title.value,
    content: EMPTY_DOC,
    plainText: "",
    contentVersion: 1,
    position: input.position,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}
