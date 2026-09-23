import type { Page } from "./page";
import type { TiptapDoc } from "./plain-text";

export interface UpdateIfVersionInput {
  pageId: string;
  ownerId: string;
  expectedVersion: number;
  content: TiptapDoc;
  plainText: string;
  updatedAt: Date;
}

export type UpdateIfVersionResult =
  | { updated: true; version: number }
  | { updated: false; currentVersion: number };

// Port implemented by infrastructure (Drizzle, phase 2) and by the
// in-memory test double (phase 1).
export interface PageRepository {
  findById(id: string): Promise<Page | null>;
  // Every new page of a notebook MUST get a position strictly greater than
  // all its siblings, including archived ones (specs/notebooks/spec.md).
  nextPosition(notebookId: string): Promise<number>;
  create(page: Page): Promise<void>;
  update(page: Page): Promise<void>;
  listActiveByNotebook(notebookId: string): Promise<Page[]>;
  // S4 Home overview: every active page across all of an owner's
  // notebooks, not scoped to one notebook (specs/notebooks/spec.md has no
  // scenario for this yet — it backs GetHomeOverview's real-data stats and
  // recent-pages list, never invented metrics).
  listActiveByOwner(ownerId: string): Promise<Page[]>;
  // Atomic compare-and-swap UPDATE: WHERE id, owner_id, archived_at IS NULL
  // AND content_version = expectedVersion. Never a read-compare-write
  // (design.md, "Guardado de contenido con comparar-e-intercambiar").
  updateIfVersion(input: UpdateIfVersionInput): Promise<UpdateIfVersionResult>;
}
