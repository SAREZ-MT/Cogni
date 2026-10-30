import { notFound, redirect } from "next/navigation";
import { hubHref, isNotebookId } from "@/shared/navigation/technique-hub";

interface ExamsNotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

// Phase 8 H17 (user-approved flat hubs, 2026-10-29): the exams hub lists
// every page with questions at once, so the per-notebook view is gone. Its
// old address lands on the hub filtered by the notebook; the hub shows
// nothing for an unknown or another user's id.
export default async function ExamsNotebookPage({
  params,
}: ExamsNotebookPageProps) {
  const { notebookId } = await params;
  // Not an id at all (a retired sample slug): a plain not-found.
  if (!isNotebookId(notebookId)) notFound();
  redirect(hubHref("/exams", notebookId));
}
