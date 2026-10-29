import { notFound } from "next/navigation";
import { getExamResultsAction } from "@/modules/exams";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { fromHub } from "@/shared/navigation/hub-return";
import {
  hubReturnHref,
  hubReturnQuery,
} from "@/shared/navigation/technique-hub";
import { SetBreadcrumb } from "../../../../_components/breadcrumb";
import { ExamResultsView } from "../../../_components/exam-results-view";

interface ExamResultsPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// A finished exam's results on real data (Phase 5 T6, documento-maestro
// §3.3/§7.5: a completed session is a durable record). `?sesion=<id>` picks
// the session (the player opens its results this way); without it, the
// page's last finished exam. An unknown/foreign page, an unknown or open
// session, another page's session or a page never examined 404s. Opened
// from the hub (`?desde=hub`, Phase 8 H18) the back link leads to the hub
// and "Repetir examen" / "Nuevo examen" keep the marker.
export default async function ExamResultsPage({
  params,
  searchParams,
}: ExamResultsPageProps) {
  const { notebookId, pageId } = await params;
  const { sesion, desde, cuaderno } = await searchParams;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const results = await getExamResultsAction({
    pageId: page.id,
    ...(typeof sesion === "string" ? { sessionId: sesion } : {}),
  });
  if (!results.ok) notFound();
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";
  const pageHref = `/notebooks/${notebookId}/pages/${page.id}`;
  const examPath = `/exams/${notebookId}/${page.id}`;
  const keepQuery = hubReturnQuery({ desde, cuaderno });
  const examHref = keepQuery ? `${examPath}?${keepQuery}` : examPath;

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Exámenes", href: "/exams" },
          { label: notebookTitle, href: `/notebooks/${notebookId}` },
          { label: page.title, href: pageHref },
          { label: "Resultados" },
        ]}
      />
      <ExamResultsView
        notebookTitle={notebookTitle}
        pageTitle={page.title}
        pageHref={pageHref}
        questionsHref={`${examPath}/preguntas`}
        examHref={examHref}
        results={results.value}
        {...(fromHub(desde) && {
          back: {
            href: hubReturnHref("/exams", { desde, cuaderno }, notebookId),
            label: "Exámenes",
          },
        })}
      />
    </section>
  );
}
