import { redirect } from "next/navigation";
import { hubReturnQuery } from "@/shared/navigation/technique-hub";

interface ExamQuestionsPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// The Phase 5 "Preguntas" screen became the edit page in Phase 8 H18: old
// links and bookmarks land there, keeping the hub marker. The edit page
// checks the page (404 for an unknown, archived or foreign one).
export default async function ExamQuestionsPage({
  params,
  searchParams,
}: ExamQuestionsPageProps) {
  const { notebookId, pageId } = await params;
  const { desde, cuaderno } = await searchParams;
  const keepQuery = hubReturnQuery({ desde, cuaderno });
  redirect(
    `/exams/${encodeURIComponent(notebookId)}/${encodeURIComponent(pageId)}/editar${keepQuery ? `?${keepQuery}` : ""}`,
  );
}
