"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/identity";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import {
  type ActionError,
  DomainError,
  toActionError,
} from "@/shared/kernel/domain-error";
import { isValidId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  archiveNotebook as archiveNotebookUseCase,
  archivePage as archivePageUseCase,
  createNotebook as createNotebookUseCase,
  createPage as createPageUseCase,
  getAssetReadUrl as getAssetReadUrlUseCase,
  getHomeOverview as getHomeOverviewUseCase,
  getPage as getPageUseCase,
  type HomeOverview,
  type ImageUploadGrant,
  listSidebar,
  registerPageAsset as registerPageAssetUseCase,
  renameNotebook as renameNotebookUseCase,
  renamePage as renamePageUseCase,
  requestImageUpload as requestImageUploadUseCase,
  type SidebarNotebook,
  savePage as savePageUseCase,
  setNotebookAppearance as setNotebookAppearanceUseCase,
} from "./application";
import { NOTEBOOKS_ERROR } from "./domain/errors";
import type { Notebook, NotebookColor } from "./domain/notebook";
import type { Page } from "./domain/page";
import type { PageAsset } from "./domain/page-asset-repository";
import type { TiptapDoc } from "./domain/plain-text";
import {
  DrizzleNotebookRepository,
  DrizzlePageAssetRepository,
  DrizzlePageRepository,
  SupabaseStorageGateway,
} from "./infrastructure";
import {
  messageForNotebooksErrorCode,
  NOTEBOOKS_COPY,
} from "./ui/notebooks-copy";

// Route params come straight from the URL, so both ids are validated with
// the kernel's id shape before touching the repos: Postgres rejects a
// non-uuid with an error (a 500 page), and a malformed id must 404 instead.
const routeIdSchema = z.string().refine(isValidId, "must be a valid id");
const routePageParamsSchema = z.object({
  notebookId: routeIdSchema,
  pageId: routeIdSchema,
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

// saveContent/getCurrentContent structurally satisfy editor/domain's
// Result-returning SavePagePort (design.md, "notebooks como único puerto
// de persistencia hacia el editor"), so a missing session must resolve to
// err(DomainError) here too, instead of the throwing requireOwnerId()
// every other (unwrap()-based) Server Action in this file uses. A
// rejected promise is not a shape use-autosave.ts's try/catch treats as
// a domain conflict or a transport failure it can retry.
async function requireOwnerIdResult(): Promise<Result<string, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return err(
      toActionError(
        new DomainError(
          NOTEBOOKS_ERROR.SESSION_REQUIRED,
          NOTEBOOKS_COPY.sessionRequired,
        ),
      ),
    );
  }
  return ok(user.id);
}

function deps() {
  const db = getDb();
  return {
    notebooks: new DrizzleNotebookRepository(db),
    pages: new DrizzlePageRepository(db),
    assets: new DrizzlePageAssetRepository(db),
    storage: new SupabaseStorageGateway(),
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

// E1 (editor pass, goal doc §2, "@" mentions): the mention popup's data
// source, reusing listSidebar (same one the sidebar tree consumes) instead
// of a new use case — flattened to one page per row since a mention only
// ever targets a single page, with its notebook's title/id alongside for
// the popup's description line and the mention node's link target
// (editor/domain/mention-port.ts, editor/ui/tiptap/mention-node.tsx). No
// DomainError possible, same as getSidebarTree above.
export interface MentionPageCandidate {
  id: string;
  title: string;
  notebookId: string;
  notebookTitle: string;
  // E2b scope C (mention popup restyle): the notebook's own pastel color
  // (notebooks/domain/notebook.ts's NotebookColor), so the mention row's
  // IconTile matches the sidebar/notebook-card tone instead of a generic
  // neutral tile.
  notebookColor: NotebookColor | null;
}

export async function listPagesForMention(): Promise<MentionPageCandidate[]> {
  const ownerId = await requireOwnerId();
  const { notebooks, pages } = deps();
  const sidebar = await listSidebar({ notebooks, pages }, ownerId);
  return sidebar.flatMap((notebook) =>
    notebook.pages.map((page) => ({
      id: page.id,
      title: page.title,
      notebookId: notebook.id,
      notebookTitle: notebook.title,
      notebookColor: notebook.color,
    })),
  );
}

// Home's only data dependency (S4, odd/tasks/app-shell-restyle.md): real
// stats/notebooks/recent pages, never invented metrics.
export async function getHomeOverview(): Promise<HomeOverview> {
  const ownerId = await requireOwnerId();
  const { notebooks, pages, clock } = deps();
  return getHomeOverviewUseCase({ notebooks, pages, clock }, ownerId);
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
// throwing, so editor/application/use-autosave.ts can reconcile it. The
// DomainError savePageUseCase produces is mapped to the plain ActionError
// shape here, at the Server Action boundary: React's RSC/Flight protocol
// redacts Error subclasses in transit, so a DomainError instance never
// survives as one on the client, and use-autosave.ts's conflict detection
// (isDomainErrorLike, a shape check) needs that shape, not the class.
export async function saveContent(
  input: unknown,
): Promise<Result<{ version: number }, ActionError>> {
  const ownerId = await requireOwnerIdResult();
  if (!ownerId.ok) return ownerId;
  const result = await savePageUseCase(input, deps(), ownerId.value);
  if (!result.ok) return err(toActionError(result.error));
  return result;
}

// Reads a page's current content/version — used by the editor mount point
// and by SavePagePort.getCurrent's conflict-reconciliation path. Matches
// the port's `(pageId: string) => Promise<Result<...>>` shape exactly (see
// saveContent's comment on why the error is mapped to ActionError here).
export async function getCurrentContent(
  pageId: unknown,
): Promise<Result<{ content: TiptapDoc; version: number }, ActionError>> {
  const ownerId = await requireOwnerIdResult();
  if (!ownerId.ok) return ownerId;
  const result = await getPageUseCase(
    { pageId },
    { pages: deps().pages },
    ownerId.value,
  );
  if (!result.ok) return err(toActionError(result.error));
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

// S3 breadcrumb: the page route ("{cuaderno} › {página}") needs the
// notebook's title without paying for getNotebookForRoute's full
// active-pages fetch on every page view. Review follow-up from S3
// (R3-breadcrumb-lookup-throws): a missing session or a repository failure
// must degrade to the page's own title alone, like a foreign/archived
// notebookId, never throw and break the whole page route.
export async function getNotebookTitleForRoute(
  notebookId: string,
): Promise<string | null> {
  try {
    const ownerId = await requireOwnerId();
    const notebook = await deps().notebooks.findById(notebookId);
    if (!notebook || notebook.ownerId !== ownerId || notebook.archivedAt) {
      return null;
    }
    return notebook.title;
  } catch {
    return null;
  }
}

// design.md, "Subida de imagen firmada": the image node view (editor/ui)
// treats every failure as a friendly Spanish message, never a thrown
// exception, so these three follow saveContent/getCurrentContent's
// Result-returning pattern instead of unwrap().

export async function requestImageUpload(
  input: unknown,
): Promise<Result<ImageUploadGrant, ActionError>> {
  const ownerId = await requireOwnerIdResult();
  if (!ownerId.ok) return ownerId;
  const result = await requestImageUploadUseCase(input, deps(), ownerId.value);
  if (!result.ok) return err(toActionError(result.error));
  return result;
}

export async function registerPageAsset(
  input: unknown,
): Promise<Result<PageAsset, ActionError>> {
  const ownerId = await requireOwnerIdResult();
  if (!ownerId.ok) return ownerId;
  const result = await registerPageAssetUseCase(input, deps(), ownerId.value);
  if (!result.ok) return err(toActionError(result.error));
  return result;
}

export async function getAssetReadUrl(
  input: unknown,
): Promise<Result<{ url: string }, ActionError>> {
  const ownerId = await requireOwnerIdResult();
  if (!ownerId.ok) return ownerId;
  const result = await getAssetReadUrlUseCase(input, deps(), ownerId.value);
  if (!result.ok) return err(toActionError(result.error));
  return result;
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
