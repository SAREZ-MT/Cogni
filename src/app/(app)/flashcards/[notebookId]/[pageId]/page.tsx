import { notFound } from "next/navigation";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { FlashcardPlayer } from "../../_components/flashcard-player";
import {
  getSampleCards,
  getSampleNotebook,
  getSamplePage,
} from "../../_data/sample";

interface FlashcardsSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// Study session route (design preview). One page owns at most one deck
// (product rule 2026-09-24), so the deck is identified by
// [notebookId]/[pageId] instead of a `?deck=` query param — there is no
// separate deck id to resolve. Hands the page's fixed sample cards to the
// client FlashcardPlayer; no session state lives on the server. An unknown
// notebook or page 404s.
export default async function FlashcardsSessionPage({
  params,
}: FlashcardsSessionPageProps) {
  const { notebookId, pageId } = await params;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const page = getSamplePage(notebookId, pageId);
  if (!page) notFound();

  const cards = getSampleCards(page.id);

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Flashcards", href: "/flashcards" },
          { label: notebook.title, href: `/flashcards/${notebookId}` },
          { label: page.title },
        ]}
      />
      <FlashcardPlayer
        notebookId={notebookId}
        deckLabel={page.title}
        cards={cards}
      />
    </section>
  );
}
