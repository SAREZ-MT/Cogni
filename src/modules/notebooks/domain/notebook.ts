import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { NOTEBOOK_ERROR } from "./errors";

// Cogni's pastel palette (documento-maestro design system); a notebook's
// color is null or one of these names, never a raw hex value.
export const COLOR_PALETTE = [
  "pink",
  "green",
  "yellow",
  "purple",
  "orange",
  "blue",
  "mint",
] as const;

export type NotebookColor = (typeof COLOR_PALETTE)[number];

export const TITLE_MAX_LENGTH = 120;

// Shared with Page: both entities enforce the same non-empty,
// max-120-characters title rule (specs/notebooks/spec.md).
export function validateTitle(title: string): Result<string, DomainError> {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return err(
      new DomainError(NOTEBOOK_ERROR.INVALID_TITLE, "title must not be blank"),
    );
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return err(
      new DomainError(
        NOTEBOOK_ERROR.INVALID_TITLE,
        `title must be at most ${TITLE_MAX_LENGTH} characters`,
      ),
    );
  }
  return ok(trimmed);
}

export function validateColor(
  color: string | null | undefined,
): Result<NotebookColor | null, DomainError> {
  if (color === null || color === undefined) return ok(null);
  if (!(COLOR_PALETTE as readonly string[]).includes(color)) {
    return err(
      new DomainError(
        NOTEBOOK_ERROR.INVALID_COLOR,
        `color must be one of ${COLOR_PALETTE.join(", ")}`,
      ),
    );
  }
  return ok(color as NotebookColor);
}

export interface Notebook {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly icon: string | null;
  readonly color: NotebookColor | null;
  readonly position: number;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewNotebook {
  id: string;
  ownerId: string;
  title: string;
  icon?: string | null;
  color?: string | null;
  position: number;
}

export function createNotebook(
  input: NewNotebook,
  clock: Clock,
): Result<Notebook, DomainError> {
  const title = validateTitle(input.title);
  if (!title.ok) return title;
  const color = validateColor(input.color);
  if (!color.ok) return color;

  const now = clock.now();
  return ok({
    id: input.id,
    ownerId: input.ownerId,
    title: title.value,
    icon: input.icon ?? null,
    color: color.value,
    position: input.position,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}
