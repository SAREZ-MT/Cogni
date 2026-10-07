// Port of the paragraph fingerprints a technique already used for AI
// generation on a page (Phase 6 T5c, table generation_fingerprints). One
// repository instance is bound to one technique: flashcards, exams and
// active recall each remember their own paragraphs, so generating flashcards
// never makes a paragraph "old" for exams.
export const GENERATION_TECHNIQUES = ["flashcards", "exam", "recall"] as const;

export type GenerationTechnique = (typeof GENERATION_TECHNIQUES)[number];

export interface GenerationFingerprintRepository {
  // The technique's stored fingerprints for the owner's page, in no order.
  listByPage(pageId: string, ownerId: string): Promise<string[]>;
  // Stores the fingerprints of the paragraphs a generation sent. Already
  // stored ones are left as they are (idempotent: a concurrent generation
  // that sent the same paragraph is not an error).
  addMany(input: {
    ownerId: string;
    pageId: string;
    fingerprints: readonly string[];
    now: Date;
  }): Promise<void>;
}
