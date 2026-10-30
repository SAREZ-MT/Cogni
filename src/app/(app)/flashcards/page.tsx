import { FileText, Layers, Pencil } from "lucide-react";
import Link from "next/link";
import { type DeckView, listDecksAction } from "@/modules/flashcards";
import { getCurrentTimeZoneSetting } from "@/modules/identity";
import { listDueTodayAction } from "@/modules/scheduling";
import {
  hubItemHref,
  notebookFilter,
  orderHubItems,
} from "@/shared/navigation/technique-hub";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { TechniqueEmptyArt } from "@/shared/ui/technique-empty-art";
import {
  TechniqueHubFilter,
  TechniqueHubGroupTitle,
} from "@/shared/ui/technique-hub-filter";
import { TechniqueHubHeader } from "@/shared/ui/technique-hub-header";
import {
  TechniqueItemCard,
  TechniqueItemCheck,
  TechniqueItemPill,
} from "@/shared/ui/technique-item-card";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { loadCreateExamNotebooks } from "../exams/_lib/create-exam-notebooks";
import { CreateFromPageDialog } from "./_components/create-from-page-dialog";
import {
  DeleteDeckMenuItem,
  DeleteDeckProvider,
} from "./_components/delete-deck";
import { nextReviewLabel } from "./_lib/next-review";
import { plural } from "./_lib/plural";
import { readRemainingGenerations } from "./_lib/remaining-generations";

// ADR 0003 (no queue): Next applies a Server Action's maxDuration from the
// page segment hosting it, and this hub's create dialog generates
// flashcards (Phase 8 H11) — the same budget as the notebook page route.
export const maxDuration = 120;

const HUB = "/flashcards";

interface FlashcardsHubPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface DeckEntry extends DeckView {
  // Cards due today (scheduling's "Repasos de hoy"); null when unknown.
  dueCount: number | null;
}

// Flashcards hub on real data, flat since Phase 8 H17 (user-approved
// mockups 2026-10-29): every deck (a page with cards, named by the page)
// is a TechniqueItemCard, filtered by notebook with `?cuaderno=` on the
// server. The decks with cards due today ("PARA HOY", filled "Repasar")
// come first, the rest ("AL DÍA", "repaso mañana / en N días" in the
// student's zone) after, each group newest first; "Repasar" opens the
// deck's graded review at once (`?repasar=1`) and returns here
// (`?desde=hub`, keeping the filter). When the due list cannot load the
// decks show their card counts only, in one group, never a false "Al día".
// The first tile creates flashcards from a page (Phase 8 H11).
export default async function FlashcardsHubPage({
  searchParams,
}: FlashcardsHubPageProps = {}) {
  const params = (await searchParams) ?? {};
  const [result, dueResult, createNotebooks, remaining, timeZone] =
    await Promise.all([
      listDecksAction(),
      listDueTodayAction(),
      loadCreateExamNotebooks(),
      readRemainingGenerations(),
      getCurrentTimeZoneSetting().then((setting) => setting.timeZone),
    ]);
  const createProps = {
    technique: "flashcards",
    notebooks: createNotebooks,
    remaining,
  } as const;
  const dueByPage = dueResult.ok
    ? new Map(dueResult.value.map((page) => [page.pageId, page.due.flashcard]))
    : null;
  const decks: DeckEntry[] = (result.ok ? result.value : []).map((deck) => ({
    ...deck,
    dueCount: dueByPage === null ? null : (dueByPage.get(deck.pageId) ?? 0),
  }));

  const filter = notebookFilter(decks, params.cuaderno, HUB);
  const ordered = orderHubItems(filter.visible, {
    pending: (deck) => (deck.dueCount ?? 0) > 0,
    neverPractised: () => false,
    recency: (deck) => Date.parse(deck.latestCardAt),
  });
  const now = new Date();
  const totalCards = decks.reduce((sum, deck) => sum + deck.count, 0);
  const notebookCount = filter.chips.length - 1;

  const card = (deck: DeckEntry) => {
    const due = deck.dueCount;
    const deckHref = `/flashcards/${deck.notebookId}/${deck.pageId}`;
    const fromHub = (href: string) => hubItemHref(href, filter.selected);
    const next = nextReviewLabel(deck.nextDueAt, now, timeZone);
    return (
      <DeleteDeckProvider
        key={deck.pageId}
        pageId={deck.pageId}
        deckTitle={deck.pageTitle}
      >
        <TechniqueItemCard
          technique="flashcards"
          href={fromHub(`${deckHref}?repasar=1`)}
          notebook={{ title: deck.notebookTitle, tone: deck.notebookColor }}
          title={deck.pageTitle}
          metric={{
            icon: Layers,
            value: deck.count,
            unit: deck.count === 1 ? "tarjeta" : "tarjetas",
          }}
          status={
            due === null ? null : due > 0 ? (
              <TechniqueItemPill>{due} para hoy</TechniqueItemPill>
            ) : (
              <>
                <TechniqueItemCheck>Al día</TechniqueItemCheck>
                {next !== null ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>repaso {next}</span>
                  </>
                ) : null}
              </>
            )
          }
          action={{ label: "Repasar" }}
          emphasis={(due ?? 0) > 0 ? "primary" : "soft"}
          menu={
            <>
              <DropdownMenuItem asChild>
                <Link href={fromHub(deckHref)}>
                  <Layers aria-hidden="true" size={15} strokeWidth={1.75} />
                  Ver tarjetas
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/notebooks/${deck.notebookId}/pages/${deck.pageId}`}
                >
                  <FileText aria-hidden="true" size={15} strokeWidth={1.75} />
                  Abrir página
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={fromHub(deckHref)}>
                  <Pencil aria-hidden="true" size={15} strokeWidth={1.75} />
                  Editar tarjetas
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DeleteDeckMenuItem />
            </>
          }
        />
      </DeleteDeckProvider>
    );
  };

  const tile = <CreateFromPageDialog {...createProps} trigger="tile" />;
  const grid = (items: DeckEntry[], withTile: boolean) => (
    <div className="@container">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3.5 @max-[520px]:grid-cols-1 @max-[520px]:gap-3">
        {withTile ? tile : null}
        {items.map(card)}
      </div>
    </div>
  );
  const dueDecks = ordered.filter((deck) => (deck.dueCount ?? 0) > 0);
  const upToDate = ordered.filter((deck) => (deck.dueCount ?? 0) === 0);

  return (
    <section
      data-technique-theme="flashcards"
      className="flex flex-1 flex-col gap-6"
    >
      <SetBreadcrumb items={[{ label: "Flashcards" }]} />

      <TechniqueHubHeader
        technique="flashcards"
        title="Flashcards"
        description={`${plural(totalCards, "tarjeta", "tarjetas")} · ${plural(decks.length, "mazo", "mazos")} · ${plural(notebookCount, "cuaderno", "cuadernos")}`}
      />

      {decks.length === 0 ? (
        // Phase 8 H10/H11: the illustrated empty state — the deck on the
        // amber dotted paper, a cascade entrance, the technique-gradient
        // headline and the amber CTA, which opens the "pick a page" dialog.
        // A failed read keeps the load error as the message.
        <IllustratedEmptyState
          entrance="cascade"
          paper
          technique="flashcards"
          art={<TechniqueEmptyArt technique="flashcards" />}
          title="Tus primeras flashcards te esperan"
          description={
            result.ok
              ? "Elige una página de tus cuadernos y la IA crea tarjetas para repasarlas aquí."
              : "No pudimos cargar tus mazos. Intenta de nuevo."
          }
          action={<CreateFromPageDialog {...createProps} trigger="cta" />}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <TechniqueHubFilter chips={filter.chips} />
          {ordered.length === 0 ? (
            <>
              <p className="text-fg-muted text-sm">
                Este cuaderno aún no tiene mazos.
              </p>
              {grid([], true)}
            </>
          ) : dueByPage === null ? (
            grid(ordered, true)
          ) : (
            <>
              {dueDecks.length > 0 ? (
                <section
                  aria-labelledby="flashcards-due"
                  className="flex flex-col gap-3.5"
                >
                  <TechniqueHubGroupTitle
                    id="flashcards-due"
                    label="Para hoy"
                    count={dueDecks.length}
                  />
                  {grid(dueDecks, true)}
                </section>
              ) : null}
              {upToDate.length > 0 ? (
                <section
                  aria-labelledby="flashcards-up-to-date"
                  className="flex flex-col gap-3.5"
                >
                  <TechniqueHubGroupTitle
                    id="flashcards-up-to-date"
                    label="Al día"
                    count={upToDate.length}
                  />
                  {grid(upToDate, dueDecks.length === 0)}
                </section>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
