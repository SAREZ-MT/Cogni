import { listDecksAction } from "@/modules/flashcards";
import { COLOR_PALETTE, type NotebookColor } from "@/modules/notebooks";
import { listDueTodayAction } from "@/modules/scheduling";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { SectionTitle } from "@/shared/ui/section-header";
import { TechniqueEmptyArt } from "@/shared/ui/technique-empty-art";
import { TechniqueHubHeader } from "@/shared/ui/technique-hub-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { loadCreateExamNotebooks } from "../exams/_lib/create-exam-notebooks";
import { CreateFromPageDialog } from "./_components/create-from-page-dialog";
import { DueTodayList, type DueTodayRow } from "./_components/due-today-list";
import { plural } from "./_lib/plural";
import { readRemainingGenerations } from "./_lib/remaining-generations";

// ADR 0003 (no queue): Next applies a Server Action's maxDuration from the
// page segment hosting it, and this hub's create dialog generates
// flashcards (Phase 8 H11) — the same budget as the notebook page route.
export const maxDuration = 120;

const DEFAULT_TONE: NotebookColor = "purple";

function toTone(color: string | null): NotebookColor {
  return COLOR_PALETTE.find((candidate) => candidate === color) ?? DEFAULT_TONE;
}

// Flashcards hub on real data: "Repasos de hoy" (Phase 4, scheduling's
// listDueToday: the pages with flashcards due now, each opening its graded
// review) above one summary card per notebook that holds at least one deck
// (a deck = a page with cards, named by the page) with its card and due
// counts. When the due list cannot load, the cards show card counts only
// instead of a false "al día". Phase 8 H11: flashcards are created from
// here too, through a "pick a page" dialog opened by the empty state's CTA
// or the grid's first, fixed tile.
export default async function FlashcardsHubPage() {
  const [result, dueResult, createNotebooks, remaining] = await Promise.all([
    listDecksAction(),
    listDueTodayAction(),
    loadCreateExamNotebooks(),
    readRemainingGenerations(),
  ]);
  const createProps = {
    technique: "flashcards",
    notebooks: createNotebooks,
    remaining,
  } as const;
  const decks = result.ok ? result.value : [];

  const dueToday: DueTodayRow[] | null = dueResult.ok
    ? dueResult.value
        .filter((page) => page.due.flashcard > 0)
        .map((page) => ({
          pageId: page.pageId,
          pageTitle: page.pageTitle,
          notebookId: page.notebookId,
          notebookTitle: page.notebookTitle,
          tone: toTone(page.notebookColor),
          dueCount: page.due.flashcard,
        }))
    : null;
  const dueByNotebook = new Map<string, number>();
  for (const page of dueToday ?? []) {
    dueByNotebook.set(
      page.notebookId,
      (dueByNotebook.get(page.notebookId) ?? 0) + page.dueCount,
    );
  }

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

      <TechniqueHubHeader
        technique="flashcards"
        title="Flashcards"
        description={`${plural(totalCards, "tarjeta", "tarjetas")} · ${plural(notebooks.length, "cuaderno", "cuadernos")}`}
      />

      {notebooks.length === 0 ? (
        // Phase 8 H10/H11: the illustrated empty state — the deck on the
        // amber dotted paper, a cascade entrance, the technique-gradient
        // headline and the amber CTA, which opens the "pick a page" dialog
        // (AI or by hand). A failed read keeps the load error as the
        // message.
        <IllustratedEmptyState
          entrance="cascade"
          paper
          technique="flashcards"
          art={<TechniqueEmptyArt technique="flashcards" />}
          title="Tus primeras flashcards te esperan"
          description={
            result.ok
              ? "Elige una página de tus cuadernos y crea tarjetas con IA o a mano para repasarlas aquí."
              : "No pudimos cargar tus mazos. Intenta de nuevo."
          }
          action={<CreateFromPageDialog {...createProps} trigger="cta" />}
        />
      ) : (
        <>
          <DueTodayList rows={dueToday} />
          <div>
            <SectionTitle>Mazos por cuaderno</SectionTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
              <CreateFromPageDialog {...createProps} trigger="tile" />
              {notebooks.map((notebook) => (
                <DeckSummaryCard
                  key={notebook.notebookId}
                  href={`/flashcards/${notebook.notebookId}`}
                  tone={notebook.tone}
                  title={notebook.title}
                  cardCount={notebook.cardCount}
                  dueCount={dueByNotebook.get(notebook.notebookId) ?? 0}
                  meta={
                    dueToday === null
                      ? plural(notebook.cardCount, "tarjeta", "tarjetas")
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
