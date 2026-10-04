import { Layers } from "lucide-react";
import { listDecksAction } from "@/modules/flashcards";
import { COLOR_PALETTE, type NotebookColor } from "@/modules/notebooks";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { SectionHeader } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { plural } from "./_lib/plural";

const DEFAULT_TONE: NotebookColor = "purple";

function toTone(color: string | null): NotebookColor {
  return COLOR_PALETTE.find((candidate) => candidate === color) ?? DEFAULT_TONE;
}

// Flashcards hub on real data (Phase 3): one summary card per notebook that
// holds at least one deck (a deck = a page with cards, named by the page).
// There is no due/pending data until the Phase 4 scheduler, so the hub shows
// card counts only: no "Estudiar ahora" quick start and no pending pills.
export default async function FlashcardsHubPage() {
  const result = await listDecksAction();
  const decks = result.ok ? result.value : [];

  const byNotebook = new Map<
    string,
    {
      notebookId: string;
      title: string;
      tone: NotebookColor;
      cardCount: number;
    }
  >();
  for (const deck of decks) {
    const entry = byNotebook.get(deck.notebookId) ?? {
      notebookId: deck.notebookId,
      title: deck.notebookTitle,
      tone: toTone(deck.notebookColor),
      cardCount: 0,
    };
    entry.cardCount += deck.count;
    byNotebook.set(deck.notebookId, entry);
  }
  const notebooks = [...byNotebook.values()];
  const totalCards = notebooks.reduce((sum, n) => sum + n.cardCount, 0);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Flashcards" }]} />

      <SectionHeader
        eyebrow="Técnicas de estudio"
        title="Flashcards"
        titleClassName="text-[26px]"
        description={`${plural(totalCards, "tarjeta", "tarjetas")} · ${plural(notebooks.length, "cuaderno", "cuadernos")}`}
      />

      {notebooks.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="warning">
              <Layers aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Sin mazos todavía"
          titleClassName="text-base"
          description={
            result.ok
              ? "Abre una página en el editor y usa el panel de Técnicas → Flashcards → Generar para crear tarjetas con IA."
              : "No pudimos cargar tus mazos. Intenta de nuevo."
          }
          descriptionClassName="max-w-[340px]"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {notebooks.map((notebook) => (
            <DeckSummaryCard
              key={notebook.notebookId}
              href={`/flashcards/${notebook.notebookId}`}
              tone={notebook.tone}
              title={notebook.title}
              meta={plural(notebook.cardCount, "tarjeta", "tarjetas")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
