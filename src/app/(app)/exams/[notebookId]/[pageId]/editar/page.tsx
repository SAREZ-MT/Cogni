import { ClipboardList, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listExamQuestionsAction } from "@/modules/exams";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { fromHub } from "@/shared/navigation/hub-return";
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
import { ExamQuestionsEditor } from "../../../_components/exam-questions-editor";

interface ExamEditPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// The exam questions' edit page (Phase 8 H18, user 2026-10-29; it replaces
// the Phase 5 "Preguntas" screen, whose route redirects here), reached
// from the hub card's "Editar preguntas", the start screen and the
// results: stem, 4 options, the correct one, concept and explanation of
// every active question, new questions and real deletions, all a local
// draft until "Guardar" (ExamQuestionsEditor). Back leads to the hub as it
// was (`?desde=hub&cuaderno=`), else to the page's exam. A page that is
// unknown, archived or not the caller's 404s; a page without questions
// links to its techniques panel (questions are born from AI).
export default async function ExamEditPage({
  params,
  searchParams,
}: ExamEditPageProps) {
  const { notebookId, pageId } = await params;
  const { desde, cuaderno } = await searchParams;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const questions = await listExamQuestionsAction({ pageId: page.id });
  if (!questions.ok) notFound();
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";
  const keepQuery = hubReturnQuery({ desde, cuaderno });
  const examHref = `/exams/${notebookId}/${page.id}${keepQuery ? `?${keepQuery}` : ""}`;
  const back = fromHub(desde)
    ? {
        href: hubReturnHref("/exams", { desde, cuaderno }, notebookId),
        label: "Exámenes",
      }
    : { href: examHref, label: "Volver al examen" };

  return (
    <section
      data-technique-theme="exams"
      className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6"
    >
      <SetBreadcrumb
        items={[
          { label: "Exámenes", href: "/exams" },
          { label: notebookTitle, href: hubHref("/exams", notebookId) },
          { label: page.title, href: examHref },
          { label: "Editar" },
        ]}
      />
      <ItemEditorHeader
        technique="exams"
        backHref={back.href}
        backLabel={back.label}
        eyebrow="Editar preguntas"
        title={page.title}
        description={[
          plural(questions.value.length, "pregunta", "preguntas"),
          "Los cambios se aplican al guardar",
        ]}
        actions={
          questions.value.length > 0 && (
            <Button asChild variant="outline">
              <Link href={examHref}>
                <Play aria-hidden="true" size={15} strokeWidth={2} />
                Hacer examen
              </Link>
            </Button>
          )
        }
      />
      {questions.value.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="rose">
              <ClipboardList aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Esta página aún no tiene preguntas"
          titleClassName="text-base"
          description="Genera preguntas desde la página con Técnicas → Exámenes."
          descriptionClassName="max-w-[380px]"
          action={
            <EmptyStateCta href={`/notebooks/${notebookId}/pages/${page.id}`}>
              Generar desde la página
            </EmptyStateCta>
          }
        />
      ) : (
        <ExamQuestionsEditor pageId={page.id} questions={questions.value} />
      )}
    </section>
  );
}
