import { notFound } from "next/navigation";
import { getRecallSessionReviewAction } from "@/modules/active-recall";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { SetBreadcrumb } from "../../../../_components/breadcrumb";
import { PastSessionResults } from "../../../_components/past-session-results";

// Same budget as the session route (ADR 0003): a results poll on a session
// whose evaluation run died schedules a new one with after(), and
// "Reintentar" does too, so this page gets the 300 s maximum as well.
export const maxDuration = 300;

interface ActiveRecallResultsPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// A past recall session's results on real data (Phase 6 T7, documento-
// maestro §3.3: a finished session is a durable record; §8.5: its
// evaluation, disagreements included, is read back). `?sesion=<id>` picks
// the session, as the notebook view's page cards link it. A missing
// session id, an unknown/foreign page, or a session that is unknown, open,
// another user's or of another page 404s.
export default async function ActiveRecallResultsPage({
  params,
  searchParams,
}: ActiveRecallResultsPageProps) {
  const { notebookId, pageId } = await params;
  const { sesion } = await searchParams;
  if (typeof sesion !== "string") notFound();
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const review = await getRecallSessionReviewAction({
    pageId: page.id,
    sessionId: sesion,
  });
  if (!review.ok) notFound();
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";
  const sessionsHref = `/active-recall/${notebookId}`;
  const sessionHref = `/active-recall/${notebookId}/${page.id}`;

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Active recall", href: "/active-recall" },
          { label: notebookTitle, href: sessionsHref },
          { label: page.title, href: sessionHref },
          { label: "Resultados" },
        ]}
      />
      <PastSessionResults
        pageTitle={page.title}
        records={review.value.records.map((record) => ({
          id: record.questionId,
          prompt: record.prompt,
          answer: record.answerText,
          selfRating: record.selfRating,
        }))}
        sessionId={review.value.sessionId}
        sessionsHref={sessionsHref}
        sessionHref={sessionHref}
      />
    </section>
  );
}
