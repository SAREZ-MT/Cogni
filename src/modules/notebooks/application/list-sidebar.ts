import type { NotebookColor } from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";
import type { PageRepository } from "../domain/page-repository";

export interface SidebarPage {
  readonly id: string;
  readonly title: string;
  // Client-only: true while an optimistically-created page still carries a
  // temporary id (SidebarTreeClient's createPage.onMutate) and the Server
  // Action hasn't returned the real one yet. Never set by the server.
  readonly pending?: boolean;
}

export interface SidebarNotebook {
  readonly id: string;
  readonly title: string;
  readonly icon: string | null;
  readonly color: NotebookColor | null;
  readonly pages: SidebarPage[];
  // Client-only: true while an optimistically-created notebook still
  // carries a temporary id (SidebarTreeClient's createNotebook.onMutate).
  // Never set by the server.
  readonly pending?: boolean;
}

// No invalid input or ownership violation is possible here: ownerId comes
// from the trusted session, so this never fails (specs/notebooks/spec.md,
// "Listado del sidebar"). content and plain_text are never included.
export async function listSidebar(
  deps: { notebooks: NotebookRepository; pages: PageRepository },
  ownerId: string,
): Promise<SidebarNotebook[]> {
  const notebooks = await deps.notebooks.listActiveByOwner(ownerId);
  const sidebar: SidebarNotebook[] = [];
  for (const notebook of notebooks) {
    const pages = await deps.pages.listActiveByNotebook(notebook.id);
    sidebar.push({
      id: notebook.id,
      title: notebook.title,
      icon: notebook.icon,
      color: notebook.color,
      pages: pages.map((page) => ({ id: page.id, title: page.title })),
    });
  }
  return sidebar;
}
