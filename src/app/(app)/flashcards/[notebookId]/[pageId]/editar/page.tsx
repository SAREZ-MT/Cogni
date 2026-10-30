import { Layers, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listFlashcardsAction } from "@/modules/flashcards";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import {
  hubHref,
  hubReturnHref,
  hubReturnQuery,
} from "@/shared/navigation/technique-hub";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { EmptyStateCta } from "@/shared/ui/empty-state-cta";
import { IconTile } from "@/shared/ui/icon-tile";
import { ItemEditorHeader } from "@/shared/ui/item-editor-header";
import { SetBreadcrumb } from "../../../../_components/breadcrumb";
import { DeckEditor } from "../../../_components/deck-editor";
import { plural } from "../../../_lib/plural";

interface DeckEditPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// The deck's edit page (Phase 8 H18, user 2026-10-29), reached from the hub
// card's "Editar": every card's front and back, new cards and real
// deletions, all a local draft until "Guardar" (DeckEditor). Back leads to
// the hub as it was (`?desde=hub&cuaderno=`), else filtered by the
// notebook. A page that is unknown, archived or not the caller's 404s; a
// page without cards has no deck to edit and links to its techniques
// panel (decks are born from AI).
export default async function DeckEditPage({
  params,
  searchParams,
}: DeckEditPageProps) {
  const { notebookId, pageId } = await params;
  const { desde, cuaderno } = await searchParams;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const cards = await listFlashcardsAction({ pageId: page.id });
  if (!cards.ok) notFound();
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";
  const keepQuery = hubReturnQuery({ desde, cuaderno });
  const deckHref = `/flashcards/${notebookId}/${page.id}${keepQuery ? `?${keepQuery}` : ""}`;

  return (
    <section
      data-technique-theme="flashcards"
      className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6"
    >
      <SetBreadcrumb
        items={[
          { label: "Flashcards", href: "/flashcards" },
          { label: notebookTitle, href: hubHref("/flashcards", notebookId) },
          { label: page.title, href: deckHref },
          { label: "Editar" },
        ]}
      />
      <ItemEditorHeader
        technique="flashcards"
        backHref={hubReturnHref("/flashcards", { desde, cuaderno }, notebookId)}
        backLabel="Flashcards"
        eyebrow="Editar mazo"
        title={page.title}
        description={[
          plural(cards.value.length, "tarjeta", "tarjetas"),
          "Los cambios se aplican al guardar",
        ]}
        actions={
          cards.value.length > 0 && (
            <Button asChild variant="outline">
              <Link href={deckHref}>
                <Play aria-hidden="true" size={15} strokeWidth={2} />
                Repasar
              </Link>
            </Button>
          )
        }
      />
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
        <DeckEditor pageId={page.id} cards={cards.value} />
      )}
    </section>
  );
}
