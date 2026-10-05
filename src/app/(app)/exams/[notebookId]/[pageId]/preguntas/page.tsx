import { notFound } from "next/navigation";
import { listExamQuestionsAction } from "@/modules/exams";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { SetBreadcrumb } from "../../../../_components/breadcrumb";
import { ExamQuestionsView } from "../../../_components/exam-questions-view";

interface ExamQuestionsPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// "Preguntas" of one page (Phase 5 T4, documento-maestro §3.3 "creadas
// manualmente"): the page's active questions on real data, with manual
// create, edit and retire. It left the design-preview gate in T4; the
// exams hub, player and results stay previews until T6/T9, so the
// breadcrumb's "Exámenes" has no link yet. A page that is unknown,
// archived, in another notebook or not the caller's 404s.
export default async function ExamQuestionsPage({
  params,
}: ExamQuestionsPageProps) {
  const { notebookId, pageId } = await params;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const questions = await listExamQuestionsAction({ pageId: page.id });
  if (!questions.ok) notFound();
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
      />
    </section>
  );
}
