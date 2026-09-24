import { notFound } from "next/navigation";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { getSampleNotebook } from "../../../flashcards/_data/sample";
import { ActiveRecallPlayer } from "../../_components/active-recall-player";
import { getRecallPage, getRecallQuestions } from "../../_data/sample";

interface ActiveRecallSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// Active recall session route (design preview). One page owns at most one
// study unit (documento-maestro §3.3), so the session is identified by
// [notebookId]/[pageId] — same contract as the flashcards session route.
// Hands the page's fixed sample questions to the client ActiveRecallPlayer;
// no session state lives on the server. An unknown notebook or page 404s.
export default async function ActiveRecallSessionPage({
  params,
}: ActiveRecallSessionPageProps) {
  const { notebookId, pageId } = await params;
  const notebook = getSampleNotebook(notebookId);
  if (!notebook) notFound();

  const page = getRecallPage(notebookId, pageId);
  if (!page) notFound();

  const questions = getRecallQuestions(page.id);

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Active recall", href: "/active-recall" },
          { label: notebook.title, href: `/active-recall/${notebookId}` },
          { label: page.title },
        ]}
      />
      <ActiveRecallPlayer
        notebookId={notebookId}
        notebookTitle={notebook.title}
        pageTitle={page.title}
        questions={questions}
      />
    </section>
  );
}
