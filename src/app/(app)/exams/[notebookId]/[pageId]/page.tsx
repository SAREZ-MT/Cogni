import { notFound } from "next/navigation";
import { getExamSessionAction, getExamStartAction } from "@/modules/exams";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { ExamPlayer } from "../../_components/exam-player";
import { ExamStart } from "../../_components/exam-start";

interface ExamSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// A page's exam on real data (Phase 5 T6, documento-maestro §3.3). One page
// owns at most one exam, so the route is [notebookId]/[pageId]: while the
// page has an open session the player resumes it (its questions, answers
// and clock); otherwise the start screen picks N (10-30) and opens one. It
// left the design-preview gate in T6; the exams hub stays a preview until
// T9, so the breadcrumb's "Exámenes" has no link yet. A page that is
// unknown, archived, in another notebook or not the caller's 404s.
export default async function ExamSessionPage({
  params,
}: ExamSessionPageProps) {
  const { notebookId, pageId } = await params;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const start = await getExamStartAction({ pageId: page.id });
  if (!start.ok) notFound();
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";
  const pageHref = `/notebooks/${notebookId}/pages/${page.id}`;
  const examHref = `/exams/${notebookId}/${page.id}`;

  const { openSessionId, lastFinishedSessionId } = start.value;
  const session = openSessionId
    ? await getExamSessionAction({ sessionId: openSessionId })
    : null;
  if (session && !session.ok) notFound();

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Exámenes" },
          { label: notebookTitle, href: `/notebooks/${notebookId}` },
          { label: page.title, href: pageHref },
          { label: "Examen" },
        ]}
      />
      {session?.ok ? (
        <ExamPlayer
          notebookId={notebookId}
          pageTitle={page.title}
          pageHref={pageHref}
          session={session.value}
        />
      ) : (
        <ExamStart
          pageId={page.id}
          pageTitle={page.title}
          pageHref={pageHref}
          questionsHref={`${examHref}/preguntas`}
          activeQuestionCount={start.value.activeQuestionCount}
          retakePending={start.value.retakePending}
          lastResultsHref={
            lastFinishedSessionId
              ? `${examHref}/resultados?sesion=${lastFinishedSessionId}`
              : null
          }
        />
      )}
    </section>
  );
}
