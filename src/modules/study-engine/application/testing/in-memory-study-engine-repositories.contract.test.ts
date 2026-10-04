import { randomUUID } from "node:crypto";
import { newStudyItem } from "../../domain/study-item";
import { InMemoryPageMasteryRepository } from "./in-memory-page-mastery-repository";
import { InMemoryReviewLogRepository } from "./in-memory-review-log-repository";
import { InMemoryStudyItemRepository } from "./in-memory-study-item-repository";
import { runPageMasteryRepositoryContract } from "./page-mastery-repository.contract";
import { runReviewLogRepositoryContract } from "./review-log-repository.contract";
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
