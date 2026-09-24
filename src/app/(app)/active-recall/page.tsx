import { Brain, Zap } from "lucide-react";
import Link from "next/link";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { getRecallPagesWithSessions, SAMPLE_NOTEBOOKS } from "./_data/sample";

// Active recall hub (design preview, mirrors flashcards/page.tsx — user
// decision 2026-09-24: "solo vamos a construir esas pantallas para validar
// el diseño"). Every notebook, page and session below comes from
// ./_data/sample.ts, never a real query.
export default function ActiveRecallHubPage() {
  const notebooksWithPages = SAMPLE_NOTEBOOKS.map((notebook) => ({
    notebook,
    pages: getRecallPagesWithSessions(notebook.id),
  })).filter((entry) => entry.pages.length > 0);
  const allPages = notebooksWithPages.flatMap((entry) => entry.pages);
  const allSessions = allPages.flatMap((page) => page.sessions);

  const totalSessions = allSessions.length;
  const activeNotebookCount = notebooksWithPages.length;
  const averageAccuracy =
    allSessions.length > 0
      ? Math.round(
          allSessions.reduce((sum, session) => sum + session.accuracy, 0) /
            allSessions.length,
        )
      : 0;

  const firstEntry = notebooksWithPages[0];
  const firstPage = firstEntry?.pages[0];
  const quickStartHref =
    firstEntry && firstPage
      ? `/active-recall/${firstEntry.notebook.id}/${firstPage.id}`
      : undefined;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Active recall" }]} />

      <SectionHeader
        eyebrow={
          <span className="flex items-center gap-2">
            Técnicas de estudio
            <Pill size="sm" tone="neutral">
              Vista previa
            </Pill>
          </span>
        }
        title="Active recall"
        titleClassName="text-[26px]"
        description={`${totalSessions} sesiones · ${activeNotebookCount} cuadernos`}
        actions={
          quickStartHref && (
            <Link
              href={quickStartHref}
              className="flex items-center gap-2.5 rounded-[14px] bg-neutral-900 px-4 py-3 transition-transform hover:-translate-y-0.5"
            >
              <IconTile
                size="30"
                radius="md"
                className="bg-white/[12%] text-white"
              >
                <Zap aria-hidden="true" size={15} strokeWidth={2} />
              </IconTile>
              <span className="text-left">
                <span className="block font-semibold text-white text-xs">
                  Nueva sesión
                </span>
                <span className="block text-[10.5px] text-white/[55%]">
                  {allPages.length} páginas con preguntas
                </span>
              </span>
            </Link>
          )
        }
      />

      {notebooksWithPages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill size="md" tone="success" dot>
            {totalSessions === 1
              ? "1 sesión guardada"
              : `${totalSessions} sesiones guardadas`}
          </Pill>
          <Pill size="md" tone="success" dot>
            {averageAccuracy}% precisión promedio
          </Pill>
          <Pill size="md" tone="neutral">
            {activeNotebookCount} cuaderno{activeNotebookCount === 1 ? "" : "s"}{" "}
            activo{activeNotebookCount === 1 ? "" : "s"}
          </Pill>
        </div>
      )}

      {notebooksWithPages.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="success">
              <Brain aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Sin sesiones todavía"
          titleClassName="text-base"
          description="Abre una página en el editor y usa Técnicas → Active recall → Generar."
          descriptionClassName="max-w-[340px]"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {notebooksWithPages.map(({ notebook, pages }) => {
            const sessionCount = pages.reduce(
              (sum, page) => sum + page.sessions.length,
              0,
            );
            const latestAccuracy = pages[0]?.sessions[0]?.accuracy ?? 0;

            return (
              <DeckSummaryCard
                key={notebook.id}
                href={`/active-recall/${notebook.id}`}
                tone={notebook.color}
                title={notebook.title}
                meta={`${sessionCount} sesiones · última ${latestAccuracy}%`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
