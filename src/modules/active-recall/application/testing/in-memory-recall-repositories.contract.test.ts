import { randomUUID } from "node:crypto";
import { createInMemoryRecallRepositories } from "./in-memory-recall-repositories";
import { runRecallRepositoriesContract } from "./recall-repositories.contract";

// The fakes have no pages or generations table: any fresh id is a valid
// page or generation id.
runRecallRepositoriesContract({
  createRepositories: () => createInMemoryRecallRepositories(),
  context: () => ({
    ownerId: "owner-1",
    otherOwnerId: "owner-2",
    newId: () => randomUUID(),
    newPageId: async () => randomUUID(),
    newGenerationId: async () => randomUUID(),
  }),
});
