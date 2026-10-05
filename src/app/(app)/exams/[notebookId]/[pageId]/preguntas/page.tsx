import { notFound } from "next/navigation";
import { getExamStartAction, listExamQuestionsAction } from "@/modules/exams";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { SetBreadcrumb } from "../../../../_components/breadcrumb";
import { ExamQuestionsView } from "../../../_components/exam-questions-view";

interface ExamQuestionsPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// "Preguntas" of one page (Phase 5 T4, documento-maestro §3.3 "creadas
// manualmente"): the page's active questions on real data, with manual
// create, edit and retire, and "Rendir examen". It left the design-preview
// gate in T4 (the player and results in T6); the exams hub stays a preview
// until T9, so the breadcrumb's "Exámenes" has no link yet. A page that is unknown,
// archived, in another notebook or not the caller's 404s.
export default async function ExamQuestionsPage({
  params,
}: ExamQuestionsPageProps) {
  const { notebookId, pageId } = await params;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const questions = await listExamQuestionsAction({ pageId: page.id });
  if (!questions.ok) notFound();
  // "Rendir examen" needs the pending-retake flag; when it cannot be read
  // the list still shows and the button stays as if no retake were pending
  // (the start screen re-checks it).
  const start = await getExamStartAction({ pageId: page.id });
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";
  const pageHref = `/notebooks/${notebookId}/pages/${page.id}`;

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Exámenes" },
          { label: notebookTitle, href: `/notebooks/${notebookId}` },
          { label: page.title, href: pageHref },
          { label: "Preguntas" },
        ]}
      />
      <ExamQuestionsView
        notebookTitle={notebookTitle}
        pageId={page.id}
        pageTitle={page.title}
        pageHref={pageHref}
        questions={questions.value}
        examHref={`/exams/${notebookId}/${page.id}`}
        retakePending={start.ok && start.value.retakePending}
      />
    </section>
  );
}
