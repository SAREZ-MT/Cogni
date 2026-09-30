import "server-only";

// Design previews are screens backed by route-local sample data (dashboard,
// flashcards, active recall, exams) that ship ahead of the real data layer.
// They are visible while developing and hidden in production, where the
// sidebar shows them as disabled "pronto" entries and their routes must 404.
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
