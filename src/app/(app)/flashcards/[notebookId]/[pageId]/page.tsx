import { Layers } from "lucide-react";
import { notFound } from "next/navigation";
import { listFlashcardsAction } from "@/modules/flashcards";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { designPreviewsEnabled } from "@/shared/config/design-previews";
import { BackLink } from "@/shared/ui/back-link";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { SectionHeader } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
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
// - Design previews on and a sample notebook/page id: the graded study
//   player on sample data (grading and SM-2 scheduling are Phase 4).
// - Otherwise: the page's real cards as an ungraded flip-card review list,
//   with "Nueva tarjeta" and a per-card archive action. A page that is
//   unknown, archived or not the caller's 404s. A page without cards has no
//   deck yet (a deck is never empty): it shows an empty state whose
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
      <div className="flex flex-col gap-3">
        <BackLink href={`/flashcards/${notebookId}`}>{notebookTitle}</BackLink>
        <SectionHeader
          eyebrow="Flashcards"
          title={page.title}
          titleClassName="text-xl"
          description={
            cards.value.length === 0
              ? "Sin tarjetas todavía"
              : plural(cards.value.length, "tarjeta", "tarjetas")
          }
          actions={<NewFlashcardDialog pageId={page.id} />}
        />
      </div>
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
    </section>
  );
}
