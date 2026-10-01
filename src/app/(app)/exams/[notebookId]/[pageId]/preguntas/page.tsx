import { notFound } from "next/navigation";
import { requireDesignPreviews } from "@/shared/config/design-previews";
import { SetBreadcrumb } from "../../../../_components/breadcrumb";
import { getSampleNotebook } from "../../../../flashcards/_data/sample";
import { ExamQuestionsView } from "../../../_components/exam-questions-view";
import {
  getExamPage,
  getExamQuestionsForManagement,
} from "../../../_data/sample";

interface ExamQuestionsPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// Manual question creation/editing route (design preview, 2026-09-24;
// documento-maestro §3.3 "creadas manualmente", Fase 5 "edición manual de
// preguntas con concept"). Hands the page's management question set
// (getExamQuestionsForManagement — a derived list, separate from the live/
// retake question sets) to the client ExamQuestionsView. An unknown
// notebook or page 404s, same contract as the other exam routes.
export default async function ExamQuestionsPage({
  params,
}: ExamQuestionsPageProps) {
  requireDesignPreviews();
  const { notebookId, pageId } = await params;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const page = getExamPage(notebookId, pageId);
  if (!page) notFound();

  const questions = getExamQuestionsForManagement(pageId);

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Exámenes", href: "/exams" },
          { label: notebook.title, href: `/exams/${notebookId}` },
          { label: page.title, href: `/exams/${notebookId}/${pageId}` },
          { label: "Preguntas" },
        ]}
      />
      <ExamQuestionsView
        notebookId={notebookId}
        notebookTitle={notebook.title}
        pageId={pageId}
        pageTitle={page.title}
        initialQuestions={questions}
      />
    </section>
  );
}
