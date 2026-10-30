import { notFound } from "next/navigation";
import { getExamSessionAction, getExamStartAction } from "@/modules/exams";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { fromHub } from "@/shared/navigation/hub-return";
import {
  hubReturnHref,
  hubReturnQuery,
} from "@/shared/navigation/technique-hub";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { ExamPlayer } from "../../_components/exam-player";
import { ExamStart } from "../../_components/exam-start";

// "Repetir examen" runs startExamRetakeAction from this route: the AI
// reformulation of the failed questions (up to 2 provider calls, each with
// a retry) needs the same budget as the notebook page's generations. Next
// applies a Server Action's maxDuration from the page segment hosting it.
export const maxDuration = 120;

interface ExamSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

// A page's exam on real data (Phase 5 T6, documento-maestro §3.3). One page
// owns at most one exam, so the route is [notebookId]/[pageId]: while the
// page has an open session the player resumes it (its questions, answers
// and clock; the open retake while one is pending, T7); otherwise the start
// screen picks N (10-30) and opens an exam, or the retake of a failed one. It
// left the design-preview gate in T6 (the hub, linked from the breadcrumb's
// "Exámenes", in T9). A page that is unknown, archived, in another notebook
// or not the caller's 404s. Opened from the hub card (`?desde=hub`, Phase 8
// H18), the back links lead to the hub (keeping `?cuaderno=`) and the
// player's results keep the marker; otherwise they lead to the page.
export default async function ExamSessionPage({
  params,
  searchParams,
}: ExamSessionPageProps) {
  const { notebookId, pageId } = await params;
  const { desde, cuaderno } = (await searchParams) ?? {};
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const start = await getExamStartAction({ pageId: page.id });
  if (!start.ok) notFound();
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";
  const pageHref = `/notebooks/${notebookId}/pages/${page.id}`;
  const examHref = `/exams/${notebookId}/${page.id}`;
  const keepQuery = hubReturnQuery({ desde, cuaderno });
  const back = fromHub(desde)
    ? {
        href: hubReturnHref("/exams", { desde, cuaderno }, notebookId),
        label: "Exámenes",
      }
    : undefined;

  const {
    openSessionId,
    openRetakeSessionId,
    retakePending,
    lastFinishedSessionId,
  } = start.value;
  // While a retake is pending only the retake may be taken (§7.5).
  const resumeId = retakePending ? openRetakeSessionId : openSessionId;
  const session = resumeId
    ? await getExamSessionAction({ sessionId: resumeId })
    : null;
  if (session && !session.ok) notFound();

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Exámenes", href: "/exams" },
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
          {...(back && { back, keepQuery })}
        />
      ) : (
        <ExamStart
          pageId={page.id}
          pageTitle={page.title}
          pageHref={pageHref}
          questionsHref={`${examHref}/editar${keepQuery ? `?${keepQuery}` : ""}`}
          activeQuestionCount={start.value.activeQuestionCount}
          retakePending={retakePending}
          failedRootCount={start.value.failedRootCount}
          lastResultsHref={
            lastFinishedSessionId
              ? `${examHref}/resultados?sesion=${lastFinishedSessionId}${keepQuery ? `&${keepQuery}` : ""}`
              : null
          }
          {...(back && { back })}
        />
      )}
    </section>
  );
}
