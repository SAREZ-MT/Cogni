import { notFound } from "next/navigation";
import { requireDesignPreviews } from "@/shared/config/design-previews";
import { SetBreadcrumb } from "../../../../_components/breadcrumb";
import { getSampleNotebook } from "../../../../flashcards/_data/sample";
import { ExamResultsView } from "../../../_components/exam-results-view";
import {
  getExamPage,
  getExamQuestions,
  getLastExamSession,
} from "../../../_data/sample";

interface ExamResultsPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// Stored exam results route (design preview, 2026-09-24; documento-maestro
// §3.3/§7.5: a completed session is a durable record, not just an
// in-session overlay). Renders the page's LAST stored session from sample
// data through the same ExamResultsView the live player uses
// (`mode="stored"`) — an unknown notebook/page, or a page never attempted,
// all 404.
export default async function ExamResultsPage({
  params,
}: ExamResultsPageProps) {
  requireDesignPreviews();
  const { notebookId, pageId } = await params;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const page = getExamPage(notebookId, pageId);
  if (!page) notFound();

  const session = getLastExamSession(pageId);
  if (!session) notFound();

  const questions = getExamQuestions(pageId, { retake: session.isRetake });

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Exámenes", href: "/exams" },
          { label: notebook.title, href: `/exams/${notebookId}` },
          { label: page.title, href: `/exams/${notebookId}/${pageId}` },
          { label: "Resultados" },
        ]}
      />
      <ExamResultsView
        notebookId={notebookId}
        pageId={pageId}
        notebookTitle={notebook.title}
        pageTitle={page.title}
        questions={questions}
        answers={session.answers}
        durationSeconds={session.durationSeconds}
        date={session.date}
        isRetake={session.isRetake}
        mode="stored"
      />
    </section>
  );
}
