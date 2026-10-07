import * as Sentry from "@sentry/nextjs";
import { getSidebarTree } from "@/modules/notebooks";
import type { CreateExamNotebook } from "../_components/create-exam-dialog";

// The owner's notebooks with their active pages for "Crear examen"'s
// pickers, from the notebooks module's public read API (the sidebar tree).
// A failed read is reported and answered as null (unknown), so the dialog
// shows a load error instead of a false "Aún no tienes cuadernos", and the
// exams screens still render.
export async function loadCreateExamNotebooks(): Promise<
  CreateExamNotebook[] | null
> {
  try {
    const tree = await getSidebarTree();
    return tree.map((notebook) => ({
      id: notebook.id,
      title: notebook.title,
      pages: notebook.pages.map((page) => ({ id: page.id, title: page.title })),
    }));
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}
