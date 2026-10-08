import { notFound } from "next/navigation";
import { getRecallSessionPlanAction } from "@/modules/active-recall";
import { getNotebookTitleForRoute, getPageForRoute } from "@/modules/notebooks";
import { SetBreadcrumb } from "../../../_components/breadcrumb";
import { ActiveRecallPlayer } from "../../_components/active-recall-player";

// ADR 0003 (no queue): Next applies a Server Action's maxDuration from the
// page segment hosting it, and `after()` runs within it. Finishing the
// session schedules the AI evaluation of every answer (one model call each,
// up to 10) with after(), so the session page gets the 300 s maximum.
export const maxDuration = 300;

interface ActiveRecallSessionPageProps {
  params: Promise<{ notebookId: string; pageId: string }>;
}

// Active recall session route on real data (Phase 6 T5). One page owns at
// most one study unit (documento-maestro §3.3), so the session is identified
// by [notebookId]/[pageId] — same contract as the flashcards and exams
// session routes. It reads the questions a session would show now (up to
// 10: due, new, then the least recently reviewed) and writes nothing: the
// player starts the session with the first saved answer. A page without
// questions shows the player's empty state. A page that is unknown,
// archived, in another notebook or not the caller's 404s. It left the
// design-preview gate in T5; the hub and notebook views follow in T7.
export default async function ActiveRecallSessionPage({
  params,
}: ActiveRecallSessionPageProps) {
  const { notebookId, pageId } = await params;
  const page = await getPageForRoute(notebookId, pageId);
  if (!page) notFound();
  const plan = await getRecallSessionPlanAction({ pageId: page.id });
  if (!plan.ok) notFound();
  const notebookTitle =
    (await getNotebookTitleForRoute(notebookId)) ?? "Cuaderno";

  return (
    <section className="flex flex-1 flex-col">
      <SetBreadcrumb
        items={[
          { label: "Active recall", href: "/active-recall" },
          { label: notebookTitle, href: `/active-recall/${notebookId}` },
          { label: page.title },
        ]}
      />
      <ActiveRecallPlayer
        notebookId={notebookId}
        notebookTitle={notebookTitle}
        pageTitle={page.title}
        pageId={page.id}
        questions={plan.value.questions}
      />
    </section>
  );
}
