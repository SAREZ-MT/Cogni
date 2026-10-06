import { ClipboardList, Zap } from "lucide-react";
import Link from "next/link";
import { type ExamHubPageView, listExamHubAction } from "@/modules/exams";
import { COLOR_PALETTE, type NotebookColor } from "@/modules/notebooks";
import { Button } from "@/shared/ui/button";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader } from "@/shared/ui/section-header";
import { StatusBanner } from "@/shared/ui/status-banner";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { plural } from "../flashcards/_lib/plural";

const DEFAULT_TONE: NotebookColor = "purple";

function toTone(color: string | null): NotebookColor {
  return COLOR_PALETTE.find((candidate) => candidate === color) ?? DEFAULT_TONE;
}

interface NotebookEntry {
  notebook: { id: string; title: string; color: NotebookColor };
  pages: ExamHubPageView[];
}

// The notebooks holding exam pages, in the hub's order (notebook title,
// then page title).
function groupByNotebook(pages: readonly ExamHubPageView[]): NotebookEntry[] {
  const byNotebook = new Map<string, NotebookEntry>();
  for (const page of pages) {
    const entry = byNotebook.get(page.notebookId) ?? {
      notebook: {
        id: page.notebookId,
        title: page.notebookTitle,
        color: toTone(page.notebookColor),
      },
      pages: [],
    };
    entry.pages.push(page);
    byNotebook.set(page.notebookId, entry);
  }
  return [...byNotebook.values()];
}

// The score of the notebook's most recently finished exam; null when none
// of its pages was examined.
function latestScoreOf(pages: readonly ExamHubPageView[]): number | null {
  let latest: ExamHubPageView | undefined;
  for (const page of pages) {
    if (page.lastFinishedAt === null) continue;
    if (!latest?.lastFinishedAt || page.lastFinishedAt > latest.lastFinishedAt)
      latest = page;
  }
  return latest?.lastScore ?? null;
}

// Exams hub on real data (Phase 5 T9, documento-maestro §3.3/§7.5): every
// page holding exam questions, grouped by notebook, whether or not it was
// ever examined (a never-examined notebook reads "sin intentar"). The
// layout is the design preview's (user decision 2026-10-06: the screens
// keep their look; the data adapts to them).
export default async function ExamsHubPage() {
  const result = await listExamHubAction();
  // A failed read shows the load error in the empty state, never a false
  // "Aún no tienes exámenes".
  const allPages = result.ok ? result.value : [];
  const notebooksWithPages = groupByNotebook(allPages);

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
      ? `/exams/${firstEntry.notebook.id}/${firstPage.pageId}`
      : undefined;

  const retakePage = pendientesDeRepetir[0];

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Exámenes" }]} />

      <SectionHeader
        eyebrow="Técnicas de estudio"
        title="Exámenes"
        titleClassName="text-[26px]"
        description={`${plural(examenesPresentados, "examen", "exámenes")} · ${plural(activeNotebookCount, "cuaderno", "cuadernos")}`}
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
                  {plural(allPages.length, "página", "páginas")} con preguntas
                </span>
              </span>
            </Link>
          )
        }
      />

      {retakePage && (
        <StatusBanner
          tone="rose"
          title={
            pendientesDeRepetir.length === 1
              ? "Tienes 1 página pendiente de repetir examen"
              : `Tienes ${pendientesDeRepetir.length} páginas pendientes de repetir examen`
          }
          description={`Fallaste el último examen de ${retakePage.pageTitle}; las preguntas falladas ${
            // Failed questions are due one SM-2 day after the exam; "Hoy"
            // counts an item once its due instant has passed.
            (retakePage.dueToday ?? 0) > 0
              ? "ya están para repasar"
              : "vencen mañana"
          }.`}
          action={
            <Button
              asChild
              size="sm"
              className="bg-pastel-pink-fg text-white hover:bg-pastel-pink-fg"
            >
              <Link
                href={`/exams/${retakePage.notebookId}/${retakePage.pageId}?retake=1`}
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
          description={
            result.ok
              ? "Abre una página en el editor y usa Técnicas → Examen → Generar."
              : "No pudimos cargar tus exámenes. Intenta de nuevo."
          }
          descriptionClassName="max-w-[340px]"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {notebooksWithPages.map(({ notebook, pages }) => {
            const sessionCount = pages.reduce(
              (sum, page) => sum + page.attempts,
              0,
            );
            const latestScore = latestScoreOf(pages);

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
