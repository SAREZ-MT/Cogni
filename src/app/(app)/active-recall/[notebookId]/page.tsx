import { Brain } from "lucide-react";
import { notFound } from "next/navigation";
import { listRecallHubAction } from "@/modules/active-recall";
import { getNotebookTitleForRoute } from "@/modules/notebooks";
import { BackLink } from "@/shared/ui/back-link";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { RecallPageCard } from "@/shared/ui/recall-page-card";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { formatUpdatedAt } from "../../_components/format";
import { plural } from "../../flashcards/_lib/plural";

interface ActiveRecallNotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

// Sessions-by-page list for one notebook on real data (Phase 6 T7): every
// page of the notebook with a finished session, each card showing its
// latest session (date, questions, AI buckets, percentage) and opening
// that session's results, where "Nueva sesión →" starts the next one. A
// page with recall questions and no finished session yet gets a
// "Practicar →" card that opens its session (Phase 8 H16). Same
// not-found contract as exams/[notebookId]/page.tsx: a notebookId that is
// unknown, archived or another user's 404s. The layout is the design
// preview's (Phase 6 UI freeze).
export default async function ActiveRecallNotebookPage({
  params,
}: ActiveRecallNotebookPageProps) {
  const { notebookId } = await params;
  const notebookTitle = await getNotebookTitleForRoute(notebookId);
  if (!notebookTitle) notFound();

  const result = await listRecallHubAction();
  // A failed read shows the load error in the empty state, never a false
  // "Sin sesiones todavía" hint.
  const pages = result.ok
    ? result.value.pages.filter((page) => page.notebookId === notebookId)
    : [];
  const totalSessions = pages.reduce(
    (sum, page) => sum + page.sessions.length,
    0,
  );

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Recordación activa", href: "/active-recall" },
          { label: notebookTitle },
        ]}
      />

      <div className="flex flex-col gap-3">
        <BackLink href="/active-recall">Recordación activa</BackLink>

        <SectionHeader
          eyebrow="Recordación activa"
          title={notebookTitle}
          titleClassName="text-xl"
          description={`${plural(totalSessions, "sesión", "sesiones")} · ${plural(pages.length, "página", "páginas")} con preguntas`}
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
          description={
            result.ok
              ? "Abre una página de este cuaderno y usa Técnicas → Recordación activa → Generar."
              : "No pudimos cargar tus sesiones. Intenta de nuevo."
          }
          descriptionClassName="max-w-[320px]"
        />
      ) : (
        <>
          <SectionTitle>Sesiones por página</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {pages.map((page) => {
              const [latest, ...previous] = page.sessions;
              // Phase 8 H16: questions without a finished session yet
              // (generated from the hub, or a session left open) open the
              // practice session.
              if (!latest) {
                return (
                  <RecallPageCard
                    key={page.pageId}
                    practice
                    href={`/active-recall/${notebookId}/${page.pageId}`}
                    notebookTitle={notebookTitle}
                    pageTitle={page.pageTitle}
                  />
                );
              }

              return (
                <RecallPageCard
                  key={page.pageId}
                  href={`/active-recall/${notebookId}/${page.pageId}/resultados?sesion=${latest.id}`}
                  notebookTitle={notebookTitle}
                  pageTitle={page.pageTitle}
                  lastSessionDate={formatUpdatedAt(new Date(latest.finishedAt))}
                  questionCount={latest.questionCount}
                  sessionCount={previous.length + 1}
                  mastery={latest.percentage ?? 0}
                  aiCorrect={latest.correct}
                  aiPartial={latest.partial}
                  aiIncorrect={latest.incorrect}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
