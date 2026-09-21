"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/identity";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import {
  archiveNotebook as archiveNotebookUseCase,
  archivePage as archivePageUseCase,
  createNotebook as createNotebookUseCase,
  createPage as createPageUseCase,
  getPage as getPageUseCase,
  listSidebar,
  renameNotebook as renameNotebookUseCase,
  renamePage as renamePageUseCase,
  type SidebarNotebook,
  savePage as savePageUseCase,
  setNotebookAppearance as setNotebookAppearanceUseCase,
} from "./application";
import type { Notebook } from "./domain/notebook";
import type { Page } from "./domain/page";
import type { TiptapDoc } from "./domain/plain-text";
import {
  DrizzleNotebookRepository,
  DrizzlePageRepository,
} from "./infrastructure";
import {
  messageForNotebooksErrorCode,
  NOTEBOOKS_COPY,
} from "./ui/notebooks-copy";

// Same shape as the other actions' Zod schemas (application/*.ts): plain
// `z.string()` ids, rejecting malformed shapes before touching the repos.
const routePageParamsSchema = z.object({
  notebookId: z.string(),
  pageId: z.string(),
});

// Server Actions are the only client-reachable entry point of this module
// (specs/notebooks/spec.md, "Puntos de entrada mediante Server Actions
// validadas"). Every one of them requires a session BEFORE calling into
// `application`, validates with Zod inside the use case, and maps
// DomainError codes to actionable Spanish "tú" copy (Scenarios "Server
// Action sin sesión", "Entrada inválida en Server Action").

async function requireOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error(NOTEBOOKS_COPY.sessionRequired);
  return user.id;
}

function deps() {
  const db = getDb();
  return {
    notebooks: new DrizzleNotebookRepository(db),
    pages: new DrizzlePageRepository(db),
    clock: systemClock,
  };
}

function unwrap<T>(result: Result<T, DomainError>): T {
  if (result.ok) return result.value;
  throw new Error(messageForNotebooksErrorCode(result.error.code));
}

// The sidebar tree and the notebook/page routes both depend on this data;
// revalidating the layout segment keeps every Server Component consumer of
// ListSidebar in sync after a mutation.
function revalidateSidebar(): void {
  revalidatePath("/", "layout");
}

export async function createNotebook(input: unknown): Promise<Notebook> {
  const ownerId = await requireOwnerId();
  const notebook = unwrap(await createNotebookUseCase(input, deps(), ownerId));
  revalidateSidebar();
  return notebook;
}

export async function renameNotebook(input: unknown): Promise<Notebook> {
  const ownerId = await requireOwnerId();
  const notebook = unwrap(await renameNotebookUseCase(input, deps(), ownerId));
  revalidateSidebar();
  return notebook;
}

export async function setNotebookAppearance(input: unknown): Promise<Notebook> {
  const ownerId = await requireOwnerId();
  const notebook = unwrap(
    await setNotebookAppearanceUseCase(input, deps(), ownerId),
  );
  revalidateSidebar();
  return notebook;
}

export async function archiveNotebook(input: unknown): Promise<Notebook> {
  const ownerId = await requireOwnerId();
  const notebook = unwrap(await archiveNotebookUseCase(input, deps(), ownerId));
  revalidateSidebar();
  return notebook;
}

export async function createPage(input: unknown): Promise<Page> {
  const ownerId = await requireOwnerId();
  const page = unwrap(await createPageUseCase(input, deps(), ownerId));
  revalidateSidebar();
  return page;
}

export async function renamePage(input: unknown): Promise<Page> {
  const ownerId = await requireOwnerId();
  const page = unwrap(await renamePageUseCase(input, deps(), ownerId));
  revalidateSidebar();
  return page;
}

export async function archivePage(input: unknown): Promise<Page> {
  const ownerId = await requireOwnerId();
  const page = unwrap(await archivePageUseCase(input, deps(), ownerId));
  revalidateSidebar();
  return page;
}

// The sidebar tree Server Component's only data dependency: no input, no
// DomainError possible (specs/notebooks/spec.md, "Listado del sidebar").
export async function getSidebarTree(): Promise<SidebarNotebook[]> {
  const ownerId = await requireOwnerId();
  const { notebooks, pages } = deps();
  return listSidebar({ notebooks, pages }, ownerId);
}

// design.md, "notebooks como único puerto de persistencia hacia el
// editor": saveContent/getCurrentContent below structurally satisfy
// SavePagePort (Result-returning, never throwing on a domain error) so the
// page route can pass them directly as the `Editor` component's `port`
// prop, instead of the throw-on-error `unwrap()` pattern the other Server
// Actions in this file use.

// Saves a page's content through the atomic compare-and-swap of
// SavePage/updateIfVersion (notebooks/application/save-page.ts). A stale
// expectedVersion resolves as err(PAGE_VERSION_CONFLICT) rather than
// throwing, so editor/application/use-autosave.ts can reconcile it.
export async function saveContent(
  input: unknown,
): Promise<Result<{ version: number }, DomainError>> {
  const ownerId = await requireOwnerId();
  return savePageUseCase(input, deps(), ownerId);
}

// Reads a page's current content/version — used by the editor mount point
// and by SavePagePort.getCurrent's conflict-reconciliation path. Matches
// the port's `(pageId: string) => Promise<Result<...>>` shape exactly.
export async function getCurrentContent(
  pageId: unknown,
): Promise<Result<{ content: TiptapDoc; version: number }, DomainError>> {
  const ownerId = await requireOwnerId();
  const result = await getPageUseCase(
    { pageId },
    { pages: deps().pages },
    ownerId,
  );
  if (!result.ok) return result;
  return ok({
    content: result.value.content,
    version: result.value.contentVersion,
  });
}

// The two functions below back the notebook/page routes' notFound()
// behaviour (specs/notebooks/spec.md, "Ruta de página ajena"): a foreign or
// archived id returns null instead of throwing, so the route can render
// Next.js's not-found UI rather than a generic error message.

export async function getNotebookForRoute(
  notebookId: string,
): Promise<{ notebook: Notebook; pages: Page[] } | null> {
  const ownerId = await requireOwnerId();
  const { notebooks, pages } = deps();
  const notebook = await notebooks.findById(notebookId);
  if (!notebook || notebook.ownerId !== ownerId || notebook.archivedAt) {
    return null;
  }
  return { notebook, pages: await pages.listActiveByNotebook(notebook.id) };
}

export async function getPageForRoute(
  notebookId: string,
  pageId: string,
): Promise<Page | null> {
  const parsed = routePageParamsSchema.safeParse({ notebookId, pageId });
  if (!parsed.success) return null;

  const ownerId = await requireOwnerId();
  const result = await getPageUseCase(
    { pageId: parsed.data.pageId },
    { pages: deps().pages },
    ownerId,
  );
  // ownerId/archived_at are already enforced by getPageUseCase; a page that
  // resolves but belongs to a different notebook than the route param is
  // still not a match for this route (a foreign notebookId must not leak
  // that the pageId exists under some other notebook it does own).
  if (!result.ok || result.value.notebookId !== parsed.data.notebookId) {
    return null;
  }
  return result.value;
}
