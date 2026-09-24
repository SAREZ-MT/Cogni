import { BookOpen } from "lucide-react";
import { notFound } from "next/navigation";
import { requireDesignPreviews } from "@/shared/config/design-previews";
import { BackLink } from "@/shared/ui/back-link";
import { DeckCard, type DeckTone } from "@/shared/ui/deck-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { getSampleNotebook, getSamplePagesWithCards } from "../_data/sample";

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

  const pages = getSamplePagesWithCards(notebookId);
  const totalCards = pages.reduce((sum, page) => sum + page.cardCount, 0);

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
          description={`${totalCards} tarjetas · ${pages.length} páginas con flashcards`}
        />
      </div>

      {pages.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="warning">
              <BookOpen aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Sin mazos todavía"
          titleClassName="text-base"
          description="Abre una página de este cuaderno y usa Técnicas → Flashcards → Generar."
          descriptionClassName="max-w-[320px]"
        />
      ) : (
        <>
          <SectionTitle>Mazos por página</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {pages.map((page, index) => (
              <DeckCard
                key={page.id}
                href={`/flashcards/${notebookId}/${page.id}`}
                tone={DECK_TONES[index % DECK_TONES.length] ?? "warning"}
                label={page.title}
                cardCount={page.cardCount}
                dueCount={page.dueCount}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
