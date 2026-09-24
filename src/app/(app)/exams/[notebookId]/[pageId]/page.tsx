import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesignPreviews } from "@/shared/config/design-previews";
import { Button } from "@/shared/ui/button";
import { StatusBanner } from "@/shared/ui/status-banner";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { getSampleNotebook } from "../../../flashcards/_data/sample";
import { ExamPlayer } from "../../_components/exam-player";
import { getExamPage, getExamQuestions } from "../../_data/sample";

interface ExamSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  // `variantes=error` is a design-preview-only flag (documento-maestro
  // §7.5 point 5: when variant generation fails on every provider, the
  // retake is blocked and the original session is never reused) — there's
  // no backend here to actually fail, so this query param simulates that
  // outcome for the design review. Not a real API contract.
  searchParams: Promise<{ retake?: string; variantes?: string }>;
}

// Exam session route (design preview). One page owns at most one exam
// (documento-maestro §3.3), so the session is identified by
// [notebookId]/[pageId] — same contract as the Flashcards/Active recall
// session routes. `?retake=1` selects the page's variant question set
// (documento-maestro §7.5: a retake never repeats the same question with
// the same wording). Hands the fixed sample questions to the client
// ExamPlayer; no session state lives on the server. An unknown notebook or
// page 404s.
export default async function ExamSessionPage({
  params,
  searchParams,
}: ExamSessionPageProps) {
  requireDesignPreviews();
  const { notebookId, pageId } = await params;
  const { retake, variantes } = await searchParams;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const page = getExamPage(notebookId, pageId);
  if (!page) notFound();

  const isRetake = retake === "1";
  const breadcrumbItems = [
    { label: "Exámenes", href: "/exams" },
    { label: notebook.title, href: `/exams/${notebookId}` },
    { label: page.title },
  ];

  if (isRetake && variantes === "error") {
    return (
      <section className="flex flex-1 flex-col">
        <SetBreadcrumb items={breadcrumbItems} />
        <div
          data-testid="retake-blocked"
          className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center py-16"
        >
          <StatusBanner
            tone="error"
            title="No pudimos preparar tu examen de repetición"
            description="La IA no logró generar preguntas nuevas sobre los conceptos que fallaste. Tu examen anterior no se reutiliza; inténtalo de nuevo en unos minutos."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-pastel-pink-fg text-white hover:bg-pastel-pink-fg"
                >
                  <Link href={`/exams/${notebookId}/${pageId}?retake=1`}>
                    Reintentar
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/exams/${notebookId}`}>
                    Volver a los exámenes
                  </Link>
                </Button>
              </div>
            }
          />
        </div>
      </section>
    );
  }

  const questions = getExamQuestions(page.id, { retake: isRetake });

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb items={breadcrumbItems} />
      <ExamPlayer
        notebookId={notebookId}
        notebookTitle={notebook.title}
        pageId={page.id}
        pageTitle={page.title}
        questions={questions}
        isRetake={isRetake}
      />
    </section>
  );
}
