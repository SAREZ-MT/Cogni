import { listDecksAction } from "@/modules/flashcards";
import { COLOR_PALETTE, type NotebookColor } from "@/modules/notebooks";
import { listDueTodayAction } from "@/modules/scheduling";
import { DeckSummaryCard } from "@/shared/ui/deck-summary-card";
import { EmptyStateCta } from "@/shared/ui/empty-state-cta";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { TechniqueEmptyArt } from "@/shared/ui/technique-empty-art";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { DueTodayList, type DueTodayRow } from "./_components/due-today-list";
import { plural } from "./_lib/plural";

const DEFAULT_TONE: NotebookColor = "purple";

function toTone(color: string | null): NotebookColor {
  return COLOR_PALETTE.find((candidate) => candidate === color) ?? DEFAULT_TONE;
}

// Flashcards hub on real data: "Repasos de hoy" (Phase 4, scheduling's
// listDueToday: the pages with flashcards due now, each opening its graded
// review) above one summary card per notebook that holds at least one deck
// (a deck = a page with cards, named by the page) with its card and due
// counts. When the due list cannot load, the cards show card counts only
// instead of a false "al día".
export default async function FlashcardsHubPage() {
  const [result, dueResult] = await Promise.all([
    listDecksAction(),
    listDueTodayAction(),
  ]);
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

      <SectionHeader
        eyebrow="Técnicas de estudio"
        title="Flashcards"
        titleClassName="text-[26px]"
        description={`${plural(totalCards, "tarjeta", "tarjetas")} · ${plural(notebooks.length, "cuaderno", "cuadernos")}`}
      />

      {notebooks.length === 0 ? (
        // Phase 8 H10 (user request 2026-10-29): the notebooks hub's
        // empty-state line (H4-T1..T3) — fanned flashcards on the dotted
        // paper, a cascade entrance, a gradient headline and the violet
        // pill to the notebooks, where a page's techniques panel generates
        // the cards. A failed read keeps the load error as the message.
        <IllustratedEmptyState
          entrance="cascade"
          paper
          art={<TechniqueEmptyArt technique="flashcards" />}
          title="Tus primeras flashcards te esperan"
          description={
            result.ok
              ? "Genera tarjetas desde cualquier página de tus cuadernos y repásalas aquí."
              : "No pudimos cargar tus mazos. Intenta de nuevo."
          }
          action={
            <EmptyStateCta href="/notebooks">Ir a mis cuadernos</EmptyStateCta>
          }
        />
      ) : (
        <>
          <DueTodayList rows={dueToday} />
          <div>
            <SectionTitle>Mazos por cuaderno</SectionTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
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
