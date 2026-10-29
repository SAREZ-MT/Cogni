import { Layers } from "lucide-react";
import { notFound } from "next/navigation";
import { listFlashcardsAction } from "@/modules/flashcards";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { designPreviewsEnabled } from "@/shared/config/design-previews";
import { fromHub } from "@/shared/navigation/hub-return";
import { EmptyState } from "@/shared/ui/empty-state";
import { EmptyStateCta } from "@/shared/ui/empty-state-cta";
import { IconTile } from "@/shared/ui/icon-tile";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { DeckReview } from "../../_components/deck-review";
import { FlashcardPlayer } from "../../_components/flashcard-player";
import { FlashcardReviewList } from "../../_components/flashcard-review-list";
import {
  getSampleCards,
  getSampleNotebook,
  getSamplePage,
} from "../../_data/sample";
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
// - Otherwise: the page's real cards as a flip-card review list, with a
//   per-card archive action and "Repasar", which runs the graded SM-2
//   session over the page's due cards (DeckReview); opened from "Repasos de
//   hoy" with `?repasar=1`, that session starts at once. A page that is
//   unknown, archived or not the caller's 404s. Cards are created by AI only
//   (Phase 8 H13, user 2026-10-29): a page without cards has no deck yet (a
//   deck is never empty), and its empty state links to the page, whose
//   techniques panel generates them.
export default async function FlashcardsSessionPage({
  params,
  searchParams,
}: FlashcardsSessionPageProps) {
  const { notebookId, pageId } = await params;
  const { repasar, desde } = await searchParams;

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
        autoStart={repasar === "1"}
        fromHub={fromHub(desde)}
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
            description="Genera un mazo desde la página con Técnicas → Flashcards."
            descriptionClassName="max-w-[360px]"
            action={
              <EmptyStateCta href={`/notebooks/${notebookId}/pages/${page.id}`}>
                Generar desde la página
              </EmptyStateCta>
            }
          />
        ) : (
          <FlashcardReviewList cards={cards.value} archivable />
        )}
      </DeckReview>
    </section>
  );
}
