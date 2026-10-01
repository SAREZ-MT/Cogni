import { BookOpen, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { requireDesignPreviews } from "@/shared/config/design-previews";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { DeckCard, type DeckTone } from "@/shared/ui/deck-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { getSampleDecks, getSampleNotebook } from "../_data/sample";

// Cycling deck-color order (studyplatform-flashcards-style.md §2
// DECK_COLORS), assigned by position within the notebook's deck list.
const DECK_TONES: readonly DeckTone[] = [
  "warning",
  "info",
  "success",
  "orange",
  "pink",
];

interface FlashcardsNotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

// Deck list for one notebook (design preview). Same not-found contract as
// the real notebooks route (notebooks/[notebookId]/page.tsx): an unknown
// notebookId 404s instead of leaking anything.
export default async function FlashcardsNotebookPage({
  params,
}: FlashcardsNotebookPageProps) {
  requireDesignPreviews();
  const { notebookId } = await params;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const decks = getSampleDecks(notebookId);
  const totalCards = decks.reduce((sum, deck) => sum + deck.cardCount, 0);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Flashcards", href: "/flashcards" },
          { label: notebook.title },
        ]}
      />

      <div className="flex flex-col gap-3">
        <BackLink href="/flashcards">Flashcards</BackLink>

        <SectionHeader
          eyebrow={
            <span className="flex items-center gap-2">
              Flashcards
              <Pill size="sm" tone="neutral">
                Vista previa
              </Pill>
            </span>
          }
          title={notebook.title}
          titleClassName="text-xl"
          description={`${totalCards} tarjetas · ${decks.length} mazos`}
          actions={
            <div className="flex items-center gap-2">
              <Button type="button" disabled>
                <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
                Nueva tarjeta
              </Button>
              <Pill size="sm" tone="neutral">
                pronto
              </Pill>
            </div>
          }
        />
      </div>

      {decks.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="warning">
              <BookOpen aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Sin mazos todavía"
          titleClassName="text-base"
          description="Crea páginas en tu cuaderno y genera flashcards con IA desde el editor."
          descriptionClassName="max-w-[320px]"
        />
      ) : (
        <>
          <SectionTitle>Mis mazos</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {decks.map((deck, index) => (
              <DeckCard
                key={deck.id}
                href={`/flashcards/${notebookId}/session?deck=${deck.id}`}
                tone={DECK_TONES[index % DECK_TONES.length] ?? "warning"}
                label={deck.label}
                cardCount={deck.cardCount}
                dueCount={deck.dueCount}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
