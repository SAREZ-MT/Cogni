import type { StudyItemRepository } from "@/modules/study-engine";
import type { GenerationFingerprintRepository } from "@/shared/kernel/generation-fingerprints";
import type { FlashcardRepository } from "../domain/flashcard-repository";

// The slice of StudyItemRepository a deck change needs: every card owns one
// StudyItem (documento-maestro §3.4), created with the card and suspended
// when the card is archived.
export type DeckStudyItems = Pick<
  StudyItemRepository,
  "save" | "findBySource" | "suspend"
>;

export interface DeckRepositories {
  readonly flashcards: FlashcardRepository;
  readonly studyItems: DeckStudyItems;
  // The "flashcards" paragraph fingerprints of a generation (Phase 6 T5c),
  // stored with its cards.
  readonly fingerprints: GenerationFingerprintRepository;
}

// Unit of work over a page's deck: everything `work` writes through the
// given repositories commits together or not at all (a thrown error rolls
// it back). Cards and their study items live in two modules, so the
// transaction boundary is this port instead of either repository.
export interface DeckUnitOfWork {
  run<T>(work: (repositories: DeckRepositories) => Promise<T>): Promise<T>;
}
