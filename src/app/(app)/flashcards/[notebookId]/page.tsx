import { redirect } from "next/navigation";
import { hubHref } from "@/shared/navigation/technique-hub";

interface FlashcardsNotebookPageProps {
  params: Promise<{ notebookId: string }>;
}

// Phase 8 H17 (user-approved flat hubs, 2026-10-29): the flashcards hub
// lists every deck at once, so the per-notebook deck list is gone. Its old
// address (bookmarks, links from before) lands on the hub filtered by the
// notebook; the hub shows nothing for an unknown or another user's id.
export default async function FlashcardsNotebookPage({
  params,
}: FlashcardsNotebookPageProps) {
  const { notebookId } = await params;
  redirect(hubHref("/flashcards", notebookId));
}
