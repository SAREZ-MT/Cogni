import { Layers } from "lucide-react";
import { notFound } from "next/navigation";
import { listDecksAction, listFlashcardsAction } from "@/modules/flashcards";
import { getCurrentTimeZoneSetting } from "@/modules/identity";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { designPreviewsEnabled } from "@/shared/config/design-previews";
import {
  hubHref,
  hubReturnHref,
  hubReturnQuery,
} from "@/shared/navigation/technique-hub";
import { EmptyState } from "@/shared/ui/empty-state";
import { EmptyStateCta } from "@/shared/ui/empty-state-cta";
import { IconTile } from "@/shared/ui/icon-tile";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { DeckReview, PRACTICE_VALUE } from "../../_components/deck-review";
import { FlashcardPlayer } from "../../_components/flashcard-player";
import {
  getSampleCards,
  getSampleNotebook,
  getSamplePage,
} from "../../_data/sample";
import { nextReviewLabel } from "../../_lib/next-review";
import { plural } from "../../_lib/plural";

interface FlashcardsSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Deck route. One page owns at most one deck (product rule 2026-09-24), so
// the deck is identified by [notebookId]/[pageId] instead of a `?deck=`
// query param.
//
// - Design previews on and a sample notebook/page id: the study player on
//   sample data, ungraded and local.
// - Otherwise (Phase 8 H18, user 2026-10-29): opening a deck practises it.
//   The graded SM-2 session over the page's due cards starts at once
//   (DeckReview autoStart; `?repasar=1` is still accepted). With nothing
//   due the deck says "Estás al día con este mazo" with its next review
//   and offers "Repasar igual", a practice pass over every card that
//   saves nothing (`?modo=practica` opens it directly). The cards are
//   listed and edited on `/flashcards/{nb}/{page}/editar`. Back leads to
//   the hub (H17), keeping `?desde=hub&cuaderno=`. A page that is unknown,
//   archived or not the caller's 404s. A page without cards has no deck
//   (a deck is never empty): its empty state links to the page, whose
//   techniques panel generates them (H13).
export default async function FlashcardsSessionPage({
  params,
  searchParams,
}: FlashcardsSessionPageProps) {
  const { notebookId, pageId } = await params;
  const { desde, cuaderno, modo } = await searchParams;

  if (designPreviewsEnabled()) {
    const sampleNotebook = getSampleNotebook(notebookId);
    const samplePage = sampleNotebook
      ? getSamplePage(notebookId, pageId)
      : undefined;
    if (sampleNotebook && samplePage) {
      return (
        <section className="flex flex-1 flex-col">
          <SetBreadcrumb
            items={[
              { label: "Flashcards", href: "/flashcards" },
              {
                label: sampleNotebook.title,
                href: hubHref("/flashcards", notebookId),
              },
              { label: samplePage.title },
            ]}
          />
          <FlashcardPlayer
            notebookId={notebookId}
            deckLabel={samplePage.title}
            cards={getSampleCards(samplePage.id)}
          />
        </section>
      );
    }
  }

  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const cards = await listFlashcardsAction({ pageId: page.id });
  if (!cards.ok) notFound();
  const [notebookTitle, nextReview] = await Promise.all([
    getNotebookTitleForRoute(notebookId).then((title) => title ?? "Cuaderno"),
    cards.value.length > 0 ? readNextReview(page.id) : null,
  ]);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Flashcards", href: "/flashcards" },
          { label: notebookTitle, href: hubHref("/flashcards", notebookId) },
          { label: page.title },
        ]}
      />
      <DeckReview
        notebookId={notebookId}
        notebookTitle={notebookTitle}
        pageId={page.id}
        deckLabel={page.title}
        description={
          cards.value.length === 0
            ? "Sin tarjetas todavía"
            : plural(cards.value.length, "tarjeta", "tarjetas")
        }
        canReview={cards.value.length > 0}
        autoStart
        practice={modo === PRACTICE_VALUE}
        practiceCards={cards.value.map(({ id, front, back }) => ({
          id,
          front,
          back,
        }))}
        nextReview={nextReview}
        backHref={hubReturnHref("/flashcards", { desde, cuaderno }, notebookId)}
        keepQuery={hubReturnQuery({ desde, cuaderno })}
      >
        {cards.value.length === 0 && (
          <EmptyState
            fill
            icon={
              <IconTile size="56" tone="warning">
                <Layers aria-hidden="true" size={28} strokeWidth={1.75} />
              </IconTile>
            }
            title="Esta página aún no tiene tarjetas"
            titleClassName="text-base"
            description="Genera un mazo desde la página con Técnicas → Flashcards."
            descriptionClassName="max-w-[360px]"
            action={
              <EmptyStateCta href={`/notebooks/${notebookId}/pages/${page.id}`}>
                Generar desde la página
              </EmptyStateCta>
            }
          />
        )}
      </DeckReview>
    </section>
  );
}

// "mañana" / "en N días" for the up-to-date state (H18), from the deck's
// earliest scheduled review in the student's time zone; null when it
// cannot be read (the state then words it without a date).
async function readNextReview(pageId: string): Promise<string | null> {
  try {
    const [decks, setting] = await Promise.all([
      listDecksAction(),
      getCurrentTimeZoneSetting(),
    ]);
    if (!decks.ok) return null;
    const deck = decks.value.find((entry) => entry.pageId === pageId);
    if (!deck) return null;
    return nextReviewLabel(deck.nextDueAt, new Date(), setting.timeZone);
  } catch {
    return null;
  }
}
