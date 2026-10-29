import { MIN_GENERATION_WORDS } from "@/shared/kernel/generation-capacity";

// Spanish copy for a page with too little text to generate from (Phase 8
// H14, user decision 2026-10-29), shared by the techniques panel and the
// technique hubs' create dialogs.

// The line for AI_PAGE_TOO_SHORT; `minWords` comes with the action error
// (150 for recall's ten questions, more for a larger exam).
export function pageTooShortMessage(
  minWords: number = MIN_GENERATION_WORDS,
): string {
  return `Esta página tiene poco contenido para generar. Agrega más texto (mínimo ${minWords} palabras).`;
}

// The hint beside a page that cannot be generated from: in the page picker
// and under the panel's "Generar".
// `minWords` is the technique's own minimum (150 for recall's ten questions
// and for a 10-question exam).
export function shortPageHint(
  words: number,
  minWords: number = MIN_GENERATION_WORDS,
): string {
  return `Muy poco contenido (${words} ${words === 1 ? "palabra" : "palabras"}): escribe al menos ${minWords}`;
}
