import { ClipboardList, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader } from "@/shared/ui/section-header";
import { StatusBanner } from "@/shared/ui/status-banner";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { getExamPagesWithQuestions, SAMPLE_NOTEBOOKS } from "./_data/sample";

// Exams hub (design preview, mirrors flashcards/page.tsx and
// active-recall/page.tsx — user decision 2026-09-24: "solo vamos a
// construir esas pantallas para validar el diseño"). Every notebook, page
// and question below comes from ./_data/sample.ts, never a real query.
// Product rule (documento-maestro §3.3/§7.5): a page appears here once it
// has generated exam questions, independent of whether it has been
// attempted yet — so "Derivadas parciales" (0 attempts) still shows up,
// with a "Sin intentar" pill instead of a score.
export default function ExamsHubPage() {
  const notebooksWithPages = SAMPLE_NOTEBOOKS.map((notebook) => ({
    notebook,
    pages: getExamPagesWithQuestions(notebook.id),
  })).filter((entry) => entry.pages.length > 0);
  const allPages = notebooksWithPages.flatMap((entry) => entry.pages);

  const examenesPresentados = allPages.reduce(
    (sum, page) => sum + page.attempts,
    0,
  );
  const aprobados = allPages.filter((page) => page.passed).length;
  const pendientesDeRepetir = allPages.filter((page) => page.retakePending);
  const activeNotebookCount = notebooksWithPages.length;

  const firstEntry = notebooksWithPages[0];
  const firstPage = firstEntry?.pages[0];
  const quickStartHref =
    firstEntry && firstPage
      ? `/exams/${firstEntry.notebook.id}/${firstPage.id}`
      : undefined;

  // Only one retake-pending page exists in this preview (Mitocondria), but
  // the banner still reads off the real data instead of hardcoding its copy.
  const retakePage = pendientesDeRepetir[0];
  const retakeNotebook = retakePage
    ? SAMPLE_NOTEBOOKS.find((notebook) => notebook.id === retakePage.notebookId)
    : undefined;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Exámenes" }]} />

      <SectionHeader
        eyebrow={
          <span className="flex items-center gap-2">
            Técnicas de estudio
            <Pill size="sm" tone="neutral">
              Vista previa
            </Pill>
          </span>
        }
        title="Exámenes"
        titleClassName="text-[26px]"
        description={`${examenesPresentados} exámenes · ${activeNotebookCount} cuadernos`}
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
                  Nuevo examen
                </span>
                <span className="block text-[10.5px] text-white/[55%]">
                  {allPages.length} páginas con preguntas
                </span>
              </span>
            </Link>
          )
        }
      />

      {retakePage && retakeNotebook && (
        <StatusBanner
          tone="rose"
          title={
            pendientesDeRepetir.length === 1
              ? "Tienes 1 página pendiente de repetir examen"
              : `Tienes ${pendientesDeRepetir.length} páginas pendientes de repetir examen`
          }
          description={`Fallaste el último examen de ${retakePage.title}; las preguntas falladas vencen mañana.`}
          action={
            <Button
              asChild
              size="sm"
              className="bg-pastel-pink-fg text-white hover:bg-pastel-pink-fg"
            >
              <Link
                href={`/exams/${retakeNotebook.id}/${retakePage.id}?retake=1`}
              >
                Repetir examen
              </Link>
            </Button>
          }
        />
      )}

      {notebooksWithPages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill size="md" tone="neutral">
            {examenesPresentados === 1
              ? "1 examen presentado"
              : `${examenesPresentados} exámenes presentados`}
          </Pill>
          <Pill size="md" tone="success" dot>
            {aprobados} aprobado{aprobados === 1 ? "" : "s"}
          </Pill>
          <Pill
            size="md"
            tone={pendientesDeRepetir.length > 0 ? "pink" : "neutral"}
            dot
          >
            {pendientesDeRepetir.length} pendiente
            {pendientesDeRepetir.length === 1 ? "" : "s"} de repetir
          </Pill>
        </div>
      )}

      {notebooksWithPages.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="pink">
              <ClipboardList aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Aún no tienes exámenes"
          titleClassName="text-base"
          description="Abre una página en el editor y usa Técnicas → Examen → Generar."
          descriptionClassName="max-w-[340px]"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {notebooksWithPages.map(({ notebook, pages }) => {
            const sessionCount = pages.reduce(
              (sum, page) => sum + page.attempts,
              0,
            );
            const latestScore = pages[0]?.lastScore ?? null;

            return (
              <DeckSummaryCard
                key={notebook.id}
                href={`/exams/${notebook.id}`}
                tone={notebook.color}
                title={notebook.title}
                meta={
                  latestScore !== null
                    ? `${sessionCount === 1 ? "1 examen" : `${sessionCount} exámenes`} · última nota ${latestScore} %`
                    : `${sessionCount === 1 ? "1 examen" : `${sessionCount} exámenes`} · sin intentar`
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
