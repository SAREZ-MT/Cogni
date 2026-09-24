import { Brain } from "lucide-react";
import { notFound } from "next/navigation";
import { BackLink } from "@/shared/ui/back-link";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { RecallPageCard } from "@/shared/ui/recall-page-card";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { getSampleNotebook } from "../../flashcards/_data/sample";
import { getRecallPagesWithSessions } from "../_data/sample";

interface ActiveRecallNotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

// Sessions-by-page list for one notebook (design preview). Same not-found
// contract as flashcards/[notebookId]/page.tsx: an unknown notebookId 404s.
export default async function ActiveRecallNotebookPage({
  params,
}: ActiveRecallNotebookPageProps) {
  const { notebookId } = await params;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const pages = getRecallPagesWithSessions(notebookId);
  const totalSessions = pages.reduce(
    (sum, page) => sum + page.sessions.length,
    0,
  );

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Active recall", href: "/active-recall" },
          { label: notebook.title },
        ]}
      />

      <div className="flex flex-col gap-3">
        <BackLink href="/active-recall">Active recall</BackLink>

        <SectionHeader
          eyebrow={
            <span className="flex items-center gap-2">
              Active recall
              <Pill size="sm" tone="neutral">
                Vista previa
              </Pill>
            </span>
          }
          title={notebook.title}
          titleClassName="text-xl"
          description={`${totalSessions} sesiones · ${pages.length} páginas con preguntas`}
        />
      </div>

      {pages.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="success">
              <Brain aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Sin sesiones todavía"
          titleClassName="text-base"
          description="Abre una página de este cuaderno y usa Técnicas → Active recall → Generar."
          descriptionClassName="max-w-[320px]"
        />
      ) : (
        <>
          <SectionTitle>Sesiones por página</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {pages.map((page) => {
              const [latest, ...previous] = page.sessions;
              if (!latest) return null;

              return (
                <RecallPageCard
                  key={page.id}
                  href={`/active-recall/${notebookId}/${page.id}`}
                  notebookTitle={notebook.title}
                  pageTitle={page.title}
                  lastSessionDate={latest.date}
                  questionCount={latest.questionCount}
                  sessionCount={previous.length + 1}
                  accuracy={latest.accuracy}
                  correct={latest.correct}
                  partial={latest.partial}
                  incorrect={latest.incorrect}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
