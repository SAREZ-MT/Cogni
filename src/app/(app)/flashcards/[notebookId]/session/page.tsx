import { notFound } from "next/navigation";
import { requireDesignPreviews } from "@/shared/config/design-previews";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { FlashcardPlayer } from "../../_components/flashcard-player";
import {
  getSampleCards,
  getSampleDecks,
  getSampleNotebook,
} from "../../_data/sample";

interface FlashcardsSessionPageProps {
  params: Promise<{ notebookId: string }>;
  searchParams: Promise<{ deck?: string }>;
}

// Study session route (design preview). Resolves the sample deck from the
// `?deck=` query param — falling back to the notebook's first deck so a
// bare `/session` link still works — then hands its fixed sample cards to
// the client FlashcardPlayer. No session state lives on the server; an
// unknown notebook or a notebook with no decks at all 404s.
export default async function FlashcardsSessionPage({
  params,
  searchParams,
}: FlashcardsSessionPageProps) {
  requireDesignPreviews();
  const { notebookId } = await params;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const decks = getSampleDecks(notebookId);
  const { deck: deckId } = await searchParams;
  const deck =
    (deckId ? decks.find((candidate) => candidate.id === deckId) : undefined) ??
    decks[0];
  if (!deck) notFound();

  const cards = getSampleCards(deck.id);

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Flashcards", href: "/flashcards" },
          { label: notebook.title, href: `/flashcards/${notebookId}` },
          { label: deck.label },
        ]}
      />
      <FlashcardPlayer
        notebookId={notebookId}
        deckLabel={deck.label}
        cards={cards}
      />
    </section>
  );
}
