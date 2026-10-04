import { Layers } from "lucide-react";
import { notFound } from "next/navigation";
import { listFlashcardsAction } from "@/modules/flashcards";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { designPreviewsEnabled } from "@/shared/config/design-previews";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { DeckReview } from "../../_components/deck-review";
import { FlashcardPlayer } from "../../_components/flashcard-player";
import { FlashcardReviewList } from "../../_components/flashcard-review-list";
import { NewFlashcardDialog } from "../../_components/new-flashcard-dialog";
import {
  getSampleCards,
  getSampleNotebook,
  getSamplePage,
} from "../../_data/sample";
import { plural } from "../../_lib/plural";

interface FlashcardsSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// Deck route. One page owns at most one deck (product rule 2026-09-24), so
// the deck is identified by [notebookId]/[pageId] instead of a `?deck=`
// query param.
//
// - Design previews on and a sample notebook/page id: the study player on
//   sample data, ungraded and local.
// - Otherwise: the page's real cards as a flip-card review list, with
//   "Nueva tarjeta", a per-card archive action and "Repasar", which runs the
//   graded SM-2 session over the page's due cards (DeckReview). A page that
//   is unknown, archived or not the caller's 404s. A page without cards has
//   no deck yet (a deck is never empty): it shows an empty state whose
//   "Nueva tarjeta" creates the first card and with it the deck.
export default async function FlashcardsSessionPage({
  params,
}: FlashcardsSessionPageProps) {
  const { notebookId, pageId } = await params;

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
                href: `/flashcards/${notebookId}`,
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
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Flashcards", href: "/flashcards" },
          { label: notebookTitle, href: `/flashcards/${notebookId}` },
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
        actions={<NewFlashcardDialog pageId={page.id} />}
      >
        {cards.value.length === 0 ? (
          <EmptyState
            fill
            icon={
              <IconTile size="56" tone="warning">
                <Layers aria-hidden="true" size={28} strokeWidth={1.75} />
              </IconTile>
            }
            title="Esta página aún no tiene tarjetas"
            titleClassName="text-base"
            description="Crea la primera con Nueva tarjeta o genera un mazo desde la página con Técnicas → Flashcards."
            descriptionClassName="max-w-[360px]"
          />
        ) : (
          <FlashcardReviewList cards={cards.value} archivable />
        )}
      </DeckReview>
    </section>
  );
}
