import { randomUUID } from "node:crypto";
import { runFlashcardRepositoryContract } from "./flashcard-repository.contract";
import { InMemoryFlashcardRepository } from "./in-memory-flashcard-repository";

runFlashcardRepositoryContract({
  createRepository: () => new InMemoryFlashcardRepository(),
  context: () => ({
    ownerId: "owner-1",
    otherOwnerId: "owner-2",
    newPageId: async () => randomUUID(),
    newId: () => randomUUID(),
  }),
});
