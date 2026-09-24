import { notFound } from "next/navigation";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { getSampleNotebook } from "../../../flashcards/_data/sample";
import { ExamPlayer } from "../../_components/exam-player";
import { getExamPage, getExamQuestions } from "../../_data/sample";

interface ExamSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
  searchParams: Promise<{ retake?: string }>;
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
  const { notebookId, pageId } = await params;
  const { retake } = await searchParams;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const page = getExamPage(notebookId, pageId);
  if (!page) notFound();

  const isRetake = retake === "1";
  const questions = getExamQuestions(page.id, { retake: isRetake });

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Exámenes", href: "/exams" },
          { label: notebook.title, href: `/exams/${notebookId}` },
          { label: page.title },
        ]}
      />
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
