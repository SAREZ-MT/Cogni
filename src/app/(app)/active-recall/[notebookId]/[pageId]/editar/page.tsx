import { Brain, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listRecallQuestionsAction } from "@/modules/active-recall";
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
import { plural } from "../../../../flashcards/_lib/plural";
import { RecallQuestionsEditor } from "../../../_components/recall-questions-editor";

interface RecallEditPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// The recall questions' edit page (Phase 8 H18, user 2026-10-29), reached
// from the hub card's "Editar preguntas": every question, its key concepts
// and its expected answer, new questions and real deletions, all a local
// draft until "Guardar" (RecallQuestionsEditor). Back leads to the hub as
// it was (`?desde=hub&cuaderno=`), else filtered by the notebook. A page
// that is unknown, archived or not the caller's 404s; a page without
// questions links to its techniques panel (questions are born from AI).
export default async function RecallEditPage({
  params,
  searchParams,
}: RecallEditPageProps) {
  const { notebookId, pageId } = await params;
  const { desde, cuaderno } = await searchParams;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const questions = await listRecallQuestionsAction({ pageId: page.id });
  if (!questions.ok) notFound();
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";
  const keepQuery = hubReturnQuery({ desde, cuaderno });
  const sessionHref = `/active-recall/${notebookId}/${page.id}${keepQuery ? `?${keepQuery}` : ""}`;

  return (
    <section
      data-technique-theme="recall"
      className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6"
    >
      <SetBreadcrumb
        items={[
          { label: "Recordación activa", href: "/active-recall" },
          {
            label: notebookTitle,
            href: hubHref("/active-recall", notebookId),
          },
          { label: page.title, href: sessionHref },
          { label: "Editar" },
        ]}
      />
      <ItemEditorHeader
        technique="recall"
        backHref={hubReturnHref(
          "/active-recall",
          { desde, cuaderno },
          notebookId,
        )}
        backLabel="Recordación activa"
        eyebrow="Editar preguntas"
        title={page.title}
        description={[
          plural(questions.value.length, "pregunta", "preguntas"),
          "Los cambios se aplican al guardar",
        ]}
        actions={
          questions.value.length > 0 && (
            <Button asChild variant="outline">
              <Link href={sessionHref}>
                <Play aria-hidden="true" size={15} strokeWidth={2} />
                Practicar
              </Link>
            </Button>
          )
        }
      />
      {questions.value.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="success">
              <Brain aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Esta página aún no tiene preguntas"
          titleClassName="text-base"
          description="Genera preguntas desde la página con Técnicas → Recordación activa."
          descriptionClassName="max-w-[380px]"
          action={
            <EmptyStateCta href={`/notebooks/${notebookId}/pages/${page.id}`}>
              Generar desde la página
            </EmptyStateCta>
          }
        />
      ) : (
        <RecallQuestionsEditor pageId={page.id} questions={questions.value} />
      )}
    </section>
  );
}
