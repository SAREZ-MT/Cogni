import { randomUUID } from "node:crypto";
import { runExamRepositoriesContract } from "./exam-repositories.contract";
import { createInMemoryExamRepositories } from "./in-memory-exam-repositories";

// The fakes have no pages or generations table and no foreign keys: any
// fresh id is a valid page or generation id.
runExamRepositoriesContract({
  createRepositories: () => createInMemoryExamRepositories(),
  context: () => ({
    ownerId: "owner-1",
    otherOwnerId: "owner-2",
    newId: () => randomUUID(),
    newPageId: async () => randomUUID(),
    newGenerationId: async () => randomUUID(),
  }),
});
