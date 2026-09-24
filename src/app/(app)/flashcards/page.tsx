import { Layers, Zap } from "lucide-react";
import Link from "next/link";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { getSampleDecks, SAMPLE_NOTEBOOKS } from "./_data/sample";

// Flashcards hub (design preview, user decision 2026-09-24: "solo vamos a
// construir esas pantallas para validar el diseño"). Every notebook, deck
// and count below comes from ./_data/sample.ts, never a real query — the
// "Vista previa" pill next to the title is the only signal that this
// isn't live data yet.
export default function FlashcardsHubPage() {
  const notebooksWithDecks = SAMPLE_NOTEBOOKS.map((notebook) => ({
    notebook,
    decks: getSampleDecks(notebook.id),
  })).filter((entry) => entry.decks.length > 0);
  const allDecks = notebooksWithDecks.flatMap((entry) => entry.decks);

  const totalCards = allDecks.reduce((sum, deck) => sum + deck.cardCount, 0);
  const totalDue = allDecks.reduce((sum, deck) => sum + deck.dueCount, 0);
  const alDiaCount = allDecks.filter((deck) => deck.dueCount === 0).length;
  const activeNotebookCount = notebooksWithDecks.length;

  const dueEntry = notebooksWithDecks.find((entry) =>
    entry.decks.some((deck) => deck.dueCount > 0),
  );
  const dueDeck = dueEntry?.decks.find((deck) => deck.dueCount > 0);
  const quickStartHref =
    dueEntry && dueDeck
      ? `/flashcards/${dueEntry.notebook.id}/session?deck=${dueDeck.id}`
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

      {notebooksWithDecks.length > 0 && (
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

      {notebooksWithDecks.length === 0 ? (
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
          {notebooksWithDecks.map(({ notebook, decks }) => (
            <DeckSummaryCard
              key={notebook.id}
              href={`/flashcards/${notebook.id}`}
              tone={notebook.color}
              title={notebook.title}
              cardCount={decks.reduce((sum, deck) => sum + deck.cardCount, 0)}
              dueCount={decks.reduce((sum, deck) => sum + deck.dueCount, 0)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
