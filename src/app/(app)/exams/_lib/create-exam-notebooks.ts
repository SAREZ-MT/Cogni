import * as Sentry from "@sentry/nextjs";
import { getPagePickerTree } from "@/modules/notebooks";
import type { CreateExamNotebook } from "../_components/create-exam-dialog";

// The owner's notebooks with their active pages for "Crear examen"'s
// pickers, from the notebooks module's public read API (the page picker
// tree: the sidebar's notebooks and pages with each page's word count,
// Phase 8 H14, so a page too short to generate from is disabled).
// A failed read is reported and answered as null (unknown), so the dialog
// shows a load error instead of a false "Aún no tienes cuadernos", and the
// exams screens still render.
export async function loadCreateExamNotebooks(): Promise<
  CreateExamNotebook[] | null
> {
  try {
    const tree = await getPagePickerTree();
    return tree.map((notebook) => ({
      id: notebook.id,
      title: notebook.title,
      pages: notebook.pages.map((page) => ({
        id: page.id,
        title: page.title,
        words: page.words,
      })),
    }));
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}
