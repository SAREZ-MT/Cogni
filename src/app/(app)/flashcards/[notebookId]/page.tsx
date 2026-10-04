import { BookOpen } from "lucide-react";
import { notFound } from "next/navigation";
import { listDecksAction } from "@/modules/flashcards";
import { getNotebookTitleForRoute } from "@/modules/notebooks";
import { BackLink } from "@/shared/ui/back-link";
import { DeckCard, type DeckTone } from "@/shared/ui/deck-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { SectionHeader, SectionTitle } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../../_components/breadcrumb";
import { plural } from "../_lib/plural";

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

// Deck list for one notebook on real data (Phase 3): one deck per page that
// holds cards, titled by the page. Same not-found contract as the real
// notebooks route (notebooks/[notebookId]/page.tsx): a notebookId that is
// unknown, archived or another user's 404s instead of leaking anything. No
// due/pending status until the Phase 4 scheduler.
export default async function FlashcardsNotebookPage({
  params,
}: FlashcardsNotebookPageProps) {
  const { notebookId } = await params;
  const notebookTitle = await getNotebookTitleForRoute(notebookId);
  if (!notebookTitle) notFound();

  const result = await listDecksAction();
  const pages = result.ok
    ? result.value.filter((deck) => deck.notebookId === notebookId)
    : [];
  const totalCards = pages.reduce((sum, page) => sum + page.count, 0);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb
        items={[
          { label: "Flashcards", href: "/flashcards" },
          { label: notebookTitle },
        ]}
      />

      <div className="flex flex-col gap-3">
        <BackLink href="/flashcards">Flashcards</BackLink>

        <SectionHeader
          eyebrow="Flashcards"
          title={notebookTitle}
          titleClassName="text-xl"
          description={`${plural(totalCards, "tarjeta", "tarjetas")} · ${plural(pages.length, "página", "páginas")} con flashcards`}
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
          description={
            result.ok
              ? "Abre una página de este cuaderno y usa Técnicas → Flashcards → Generar."
              : "No pudimos cargar tus mazos. Intenta de nuevo."
          }
          descriptionClassName="max-w-[320px]"
        />
      ) : (
        <>
          <SectionTitle>Mazos por página</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {pages.map((page, index) => (
              <DeckCard
                key={page.pageId}
                href={`/flashcards/${notebookId}/${page.pageId}`}
                tone={DECK_TONES[index % DECK_TONES.length] ?? "warning"}
                label={page.pageTitle}
                cardCount={page.count}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
