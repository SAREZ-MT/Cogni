import { ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { listExamHubAction } from "@/modules/exams";
import { getNotebookTitleForRoute } from "@/modules/notebooks";
import { BackLink } from "@/shared/ui/back-link";
import { EmptyState } from "@/shared/ui/empty-state";
import { ExamPageCard } from "@/shared/ui/exam-page-card";
import { IconTile } from "@/shared/ui/icon-tile";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { formatUpdatedAt } from "../../_components/format";
import { plural } from "../../flashcards/_lib/plural";
import { CreateExamDialog } from "../_components/create-exam-dialog";
import { loadCreateExamNotebooks } from "../_lib/create-exam-notebooks";

interface ExamsNotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

// Exams-by-page list for one notebook on real data (Phase 5 T9): every page
// of the notebook holding exam questions, each card opening its exam (the
// retake while one is pending) or its last results. Same not-found contract
// as flashcards/[notebookId]/page.tsx: a notebookId that is unknown,
// archived or another user's 404s. The layout is the design preview's
// (user decision 2026-10-06).
export default async function ExamsNotebookPage({
  params,
}: ExamsNotebookPageProps) {
  const { notebookId } = await params;
  const notebookTitle = await getNotebookTitleForRoute(notebookId);
  if (!notebookTitle) notFound();

  const [result, createExamNotebooks] = await Promise.all([
    listExamHubAction(),
    loadCreateExamNotebooks(),
  ]);
  // A failed read shows the load error in the empty state, never a false
  // "Sin exámenes todavía".
  const pages = result.ok
    ? result.value.filter((page) => page.notebookId === notebookId)
    : [];
  const totalAttempts = pages.reduce((sum, page) => sum + page.attempts, 0);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Exámenes", href: "/exams" },
          { label: notebookTitle },
        ]}
      />

      <div className="flex flex-col gap-3">
        <BackLink href="/exams">Exámenes</BackLink>

        <SectionHeader
          eyebrow="Exámenes"
          title={notebookTitle}
          titleClassName="text-xl"
          description={`${plural(totalAttempts, "examen", "exámenes")} · ${plural(pages.length, "página", "páginas")} con preguntas`}
          actions={
            <CreateExamDialog
              notebooks={createExamNotebooks}
              initialNotebookId={notebookId}
            />
          }
        />
      </div>

      {pages.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="pink">
              <ClipboardList aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Sin exámenes todavía"
          titleClassName="text-base"
          description={
            result.ok
              ? "Abre una página de este cuaderno y usa Técnicas → Examen → Generar."
              : "No pudimos cargar tus exámenes. Intenta de nuevo."
          }
          descriptionClassName="max-w-[320px]"
        />
      ) : (
        <>
          <SectionTitle>Exámenes por página</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {pages.map((page) => (
              <ExamPageCard
                key={page.pageId}
                notebookId={notebookId}
                pageId={page.pageId}
                pageTitle={page.pageTitle}
                questionCount={page.questionCount}
                attempts={page.attempts}
                lastScore={page.lastScore}
                retakePending={page.retakePending}
                dueToday={page.dueToday ?? 0}
                lastDate={
                  page.lastFinishedAt
                    ? formatUpdatedAt(new Date(page.lastFinishedAt))
                    : undefined
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
