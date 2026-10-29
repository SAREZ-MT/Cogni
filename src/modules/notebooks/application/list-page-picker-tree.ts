import { countWords } from "@/shared/kernel/words";
import type { NotebookRepository } from "../domain/notebook-repository";
import type { PageRepository } from "../domain/page-repository";

export interface PagePickerPage {
  readonly id: string;
  readonly title: string;
  // Words of the page's plain_text (kernel/words.ts), so a picker can tell
  // a page too short to generate from (Phase 8 H14: 100 words minimum).
  readonly words: number;
}

export interface PagePickerNotebookEntry {
  readonly id: string;
  readonly title: string;
  readonly pages: PagePickerPage[];
}

// The technique hubs' "which page?" tree (Phase 8 H14): the same active
// notebooks and pages, in the same order, as listSidebar, each page with
// its word count. The plain text is read on the server only; it never
// leaves this use case.
export async function listPagePickerTree(
  deps: { notebooks: NotebookRepository; pages: PageRepository },
  ownerId: string,
): Promise<PagePickerNotebookEntry[]> {
  const notebooks = await deps.notebooks.listActiveByOwner(ownerId);
  const tree: PagePickerNotebookEntry[] = [];
  for (const notebook of notebooks) {
    const pages = await deps.pages.listActiveByNotebook(notebook.id);
    tree.push({
      id: notebook.id,
      title: notebook.title,
      pages: pages.map((page) => ({
        id: page.id,
        title: page.title,
        words: countWords(page.plainText),
      })),
    });
  }
  return tree;
}
