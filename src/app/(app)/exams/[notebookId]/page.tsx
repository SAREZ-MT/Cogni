import { ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { listExamHubAction } from "@/modules/exams";
import { getNotebookTitleForRoute } from "@/modules/notebooks";
import { BackLink } from "@/shared/ui/back-link";
import { EmptyState } from "@/shared/ui/empty-state";
import { ExamPageCard } from "@/shared/ui/exam-page-card";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { formatUpdatedAt } from "../../_components/format";
import { plural } from "../../flashcards/_lib/plural";

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

  const result = await listExamHubAction();
  // Never a false "Sin exámenes todavía": a failed read surfaces as an
  // error instead of the empty state.
  if (!result.ok) throw new Error(result.error.message);
  const pages = result.value.filter((page) => page.notebookId === notebookId);
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
          eyebrow={
            <span className="flex items-center gap-2">
              Exámenes
              <Pill size="sm" tone="neutral">
                Vista previa
              </Pill>
            </span>
          }
          title={notebookTitle}
          titleClassName="text-xl"
          description={`${plural(totalAttempts, "examen", "exámenes")} · ${plural(pages.length, "página", "páginas")} con preguntas`}
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
          description="Abre una página de este cuaderno y usa Técnicas → Examen → Generar."
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
