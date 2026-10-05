import { randomUUID } from "node:crypto";
import { newStudyItem } from "../../domain/study-item";
import { runFlashcardSessionRepositoryContract } from "./flashcard-session-repository.contract";
import { InMemoryFlashcardSessionRepository } from "./in-memory-flashcard-session-repository";
import { InMemoryPageMasteryRepository } from "./in-memory-page-mastery-repository";
import { InMemoryReviewLogRepository } from "./in-memory-review-log-repository";
import { InMemorySessionFeedbackRepository } from "./in-memory-session-feedback-repository";
import { InMemoryStudyItemRepository } from "./in-memory-study-item-repository";
import { runPageMasteryRepositoryContract } from "./page-mastery-repository.contract";
import { runReviewLogRepositoryContract } from "./review-log-repository.contract";
import { runSessionFeedbackRepositoryContract } from "./session-feedback-repository.contract";
import { runStudyItemRepositoryContract } from "./study-item-repository.contract";

// The fakes have no pages table and no foreign keys: any fresh id is a valid
// page or item id.
const ownership = {
  ownerId: "owner-1",
  otherOwnerId: "owner-2",
  newId: () => randomUUID(),
};

runStudyItemRepositoryContract({
  createRepository: () => new InMemoryStudyItemRepository(),
  context: () => ({ ...ownership, newPageId: async () => randomUUID() }),
});

runReviewLogRepositoryContract({
  createRepository: () => new InMemoryReviewLogRepository(),
  context: () => ({
    ...ownership,
    newItemId: async () =>
      newStudyItem({
        id: randomUUID(),
        ownerId: ownership.ownerId,
        pageId: randomUUID(),
        kind: "flashcard",
        sourceId: randomUUID(),
        now: new Date("2026-10-01T08:00:00.000Z"),
      }).id,
  }),
});

runPageMasteryRepositoryContract({
  createRepository: () => new InMemoryPageMasteryRepository(),
  context: () => ({ ...ownership, newPageId: async () => randomUUID() }),
});

runFlashcardSessionRepositoryContract({
  createRepository: () => new InMemoryFlashcardSessionRepository(),
  context: () => ({ ...ownership, newPageId: async () => randomUUID() }),
});

runSessionFeedbackRepositoryContract({
  createRepository: () => new InMemorySessionFeedbackRepository(),
  context: () => ({ ...ownership, newGenerationId: async () => randomUUID() }),
});
