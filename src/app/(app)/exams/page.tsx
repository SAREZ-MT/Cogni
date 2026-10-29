import Link from "next/link";
import { type ExamHubPageView, listExamHubAction } from "@/modules/exams";
import { COLOR_PALETTE, type NotebookColor } from "@/modules/notebooks";
import { Button } from "@/shared/ui/button";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyStateCta } from "@/shared/ui/empty-state-cta";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { Pill } from "@/shared/ui/pill";
import { StatusBanner } from "@/shared/ui/status-banner";
import { TechniqueEmptyArt } from "@/shared/ui/technique-empty-art";
import { TechniqueHubHeader } from "@/shared/ui/technique-hub-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { plural } from "../flashcards/_lib/plural";
import { CreateExamDialog } from "./_components/create-exam-dialog";
import { loadCreateExamNotebooks } from "./_lib/create-exam-notebooks";

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

// The retake banner's advice, from the failed questions only (not every
// exam question of the page): they are due one SM-2 day after the exam,
// and "Hoy" counts an item once its due instant has passed. Unknown (the
// due items could not be read) gives neutral advice.
function retakeAdvice(failedDueNow: boolean | null): string {
  if (failedDueNow === null) {
    return "repasa los conceptos fallados antes de repetir.";
  }
  return failedDueNow
    ? "las preguntas falladas ya están para repasar."
    : "las preguntas falladas vencen mañana.";
}

// Exams hub on real data (Phase 5 T9, documento-maestro §3.3/§7.5): every
// page holding exam questions, grouped by notebook, whether or not it was
// ever examined (a never-examined notebook reads "sin intentar"). The
// layout is the design preview's (user decision 2026-10-06: the screens
// keep their look; the data adapts to them).
export default async function ExamsHubPage() {
  const [result, createExamNotebooks] = await Promise.all([
    listExamHubAction(),
    loadCreateExamNotebooks(),
  ]);
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

  const retakePage = pendientesDeRepetir[0];

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Exámenes" }]} />

      <TechniqueHubHeader
        technique="exams"
        title="Exámenes"
        description={`${plural(examenesPresentados, "examen", "exámenes")} · ${plural(activeNotebookCount, "cuaderno", "cuadernos")}`}
        actions={<CreateExamDialog notebooks={createExamNotebooks} />}
      />

      {retakePage && (
        <StatusBanner
          tone="rose"
          title={
            pendientesDeRepetir.length === 1
              ? "Tienes 1 página pendiente de repetir examen"
              : `Tienes ${pendientesDeRepetir.length} páginas pendientes de repetir examen`
          }
          description={`Fallaste el último examen de ${retakePage.pageTitle}; ${retakeAdvice(retakePage.failedDueNow)}`}
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
        // Phase 8 H10 (user request 2026-10-29): the notebooks hub's
        // empty-state line — a stacked exam sheet on the dotted paper, a
        // cascade entrance, a gradient headline and the violet pill to the
        // notebooks. "Crear examen" stays in the header; it is not the CTA
        // because without a notebook its dialog only says to create one.
        // A failed read keeps the load error as the message.
        <IllustratedEmptyState
          entrance="cascade"
          paper
          technique="exams"
          art={<TechniqueEmptyArt technique="exams" />}
          title="Pon a prueba lo que sabes"
          description={
            result.ok
              ? "Genera un examen desde una página o con «Crear examen»."
              : "No pudimos cargar tus exámenes. Intenta de nuevo."
          }
          action={
            <EmptyStateCta href="/notebooks" tone="technique">
              Ir a mis cuadernos
            </EmptyStateCta>
          }
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
