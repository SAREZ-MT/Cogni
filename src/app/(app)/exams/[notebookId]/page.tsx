import { ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { BackLink } from "@/shared/ui/back-link";
import { EmptyState } from "@/shared/ui/empty-state";
import { ExamPageCard } from "@/shared/ui/exam-page-card";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { getSampleNotebook } from "../../flashcards/_data/sample";
import { getExamPagesWithQuestions } from "../_data/sample";

interface ExamsNotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

// Exams-by-page list for one notebook (design preview). Same not-found
// contract as flashcards/[notebookId]/page.tsx and
// active-recall/[notebookId]/page.tsx: an unknown notebookId 404s.
export default async function ExamsNotebookPage({
  params,
}: ExamsNotebookPageProps) {
  const { notebookId } = await params;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const pages = getExamPagesWithQuestions(notebookId);
  const totalAttempts = pages.reduce((sum, page) => sum + page.attempts, 0);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Exámenes", href: "/exams" },
          { label: notebook.title },
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
          title={notebook.title}
          titleClassName="text-xl"
          description={`${totalAttempts} exámenes · ${pages.length} páginas con preguntas`}
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
                key={page.id}
                href={`/exams/${notebookId}/${page.id}`}
                pageTitle={page.title}
                questionCount={page.questionCount}
                attempts={page.attempts}
                lastScore={page.lastScore}
                retakePending={page.retakePending}
                lastDate={page.lastDate || undefined}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
