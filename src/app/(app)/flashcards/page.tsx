import { Layers, Zap } from "lucide-react";
import Link from "next/link";
import { requireDesignPreviews } from "@/shared/config/design-previews";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { getSamplePagesWithCards, SAMPLE_NOTEBOOKS } from "./_data/sample";

// Flashcards hub (design preview, user decision 2026-09-24: "solo vamos a
// construir esas pantallas para validar el diseño"). Every notebook, deck
// and count below comes from ./_data/sample.ts, never a real query — the
// "Vista previa" pill next to the title is the only signal that this
// isn't live data yet.
export default function FlashcardsHubPage() {
  requireDesignPreviews();
  const notebooksWithPages = SAMPLE_NOTEBOOKS.map((notebook) => ({
    notebook,
    pages: getSamplePagesWithCards(notebook.id),
  })).filter((entry) => entry.pages.length > 0);
  const allPages = notebooksWithPages.flatMap((entry) => entry.pages);

  const totalCards = allPages.reduce((sum, page) => sum + page.cardCount, 0);
  const totalDue = allPages.reduce((sum, page) => sum + page.dueCount, 0);
  const alDiaCount = allPages.filter((page) => page.dueCount === 0).length;
  const activeNotebookCount = notebooksWithPages.length;

  const dueEntry = notebooksWithPages.find((entry) =>
    entry.pages.some((page) => page.dueCount > 0),
  );
  const duePage = dueEntry?.pages.find((page) => page.dueCount > 0);
  const quickStartHref =
    dueEntry && duePage
      ? `/flashcards/${dueEntry.notebook.id}/${duePage.id}`
      : undefined;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Flashcards" }]} />

      <SectionHeader
        eyebrow={
          <span className="flex items-center gap-2">
            Técnicas de estudio
            <Pill size="sm" tone="neutral">
              Vista previa
            </Pill>
          </span>
        }
        title="Flashcards"
        titleClassName="text-[26px]"
        description={`${totalCards} tarjetas · ${activeNotebookCount} cuadernos`}
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
                  Estudiar ahora
                </span>
                <span className="block text-[10.5px] text-white/[55%]">
                  {totalDue} pendientes hoy
                </span>
              </span>
            </Link>
          )
        }
      />

      {notebooksWithPages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill size="md" tone={totalDue > 0 ? "error" : "success"} dot>
            {totalDue} pendiente{totalDue === 1 ? "" : "s"} hoy
          </Pill>
          <Pill size="md" tone="success" dot>
            {alDiaCount} al día
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
            <IconTile size="56" tone="warning">
              <Layers aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Sin mazos todavía"
          titleClassName="text-base"
          description="Abre una página en el editor y usa el panel de Técnicas → Flashcards → Generar para crear tarjetas con IA."
          descriptionClassName="max-w-[340px]"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {notebooksWithPages.map(({ notebook, pages }) => (
            <DeckSummaryCard
              key={notebook.id}
              href={`/flashcards/${notebook.id}`}
              tone={notebook.color}
              title={notebook.title}
              cardCount={pages.reduce((sum, page) => sum + page.cardCount, 0)}
              dueCount={pages.reduce((sum, page) => sum + page.dueCount, 0)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
