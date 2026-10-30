// Since Phase 8 H14 (user 2026-10-29) a generation needs 100 words of new
// page text and about 15 per item, so the 10 cards or questions the AI
// specs ask for need 150. Appends a neutral study filler (156 words) to a
// spec's own sentences, keeping them first so the fake provider's quotes
// still start with them.
const FILLER_SENTENCE =
  "El texto de estudio sigue con más detalles sobre el tema para practicar.";

export const STUDY_FILLER = Array.from(
  { length: 12 },
  () => FILLER_SENTENCE,
).join(" ");

export function withStudyFiller(text: string): string {
  return `${text} ${STUDY_FILLER}`;
}
