import type { NotebookColor } from "../domain/notebook";
import type { NotebookRepository } from "../domain/notebook-repository";
import type { PageRepository } from "../domain/page-repository";

export interface SidebarPage {
  readonly id: string;
  readonly title: string;
}

export interface SidebarNotebook {
  readonly id: string;
  readonly title: string;
  readonly icon: string | null;
  readonly color: NotebookColor | null;
  readonly pages: SidebarPage[];
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
