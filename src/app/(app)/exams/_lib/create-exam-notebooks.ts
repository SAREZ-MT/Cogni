import { getSidebarTree } from "@/modules/notebooks";
import type { CreateExamNotebook } from "../_components/create-exam-dialog";

// The owner's notebooks with their active pages for "Crear examen"'s
// pickers, from the notebooks module's public read API (the sidebar tree).
// A failed read degrades to no notebooks (the dialog then says so) instead
// of breaking the exams screens.
export async function loadCreateExamNotebooks(): Promise<CreateExamNotebook[]> {
  try {
    const tree = await getSidebarTree();
    return tree.map((notebook) => ({
      id: notebook.id,
      title: notebook.title,
      pages: notebook.pages.map((page) => ({ id: page.id, title: page.title })),
    }));
  } catch {
    return [];
  }
}
