import "server-only";
import { notFound } from "next/navigation";

// Design previews are screens backed by route-local sample data that ship
// ahead of the real data layer. They are visible while developing and
// hidden in production, where the sidebar shows them as disabled "pronto"
// entries and their routes must 404. Active recall and exams left this list
// in Phases 5–6 and the dashboard in Phase 7 T4 (it runs on the analytics
// reads). Flashcards left it in Phase 3: the hub and notebook lists run on
// real data, and only the sample graded player (Phase 4) in the deck route
// still checks `designPreviewsEnabled()`.
//
// Setting COGNI_DESIGN_PREVIEWS=1 re-enables them in a production build
// (e.g. a staging deployment used for design reviews). The variable has no
// NEXT_PUBLIC_ prefix on purpose: it is read on the server and handed to
// client components as a prop, never inlined into a client bundle.
export function designPreviewsEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.NODE_ENV !== "production" || env.COGNI_DESIGN_PREVIEWS === "1";
}

// Guard for the first line of every design-preview route: answers 404 while
// previews are disabled, so sample data never reaches a production visitor.
export function requireDesignPreviews(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (!designPreviewsEnabled(env)) notFound();
}
