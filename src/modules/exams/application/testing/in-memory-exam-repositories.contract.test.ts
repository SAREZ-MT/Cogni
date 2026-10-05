import { randomUUID } from "node:crypto";
import { runExamRepositoriesContract } from "./exam-repositories.contract";
import { createInMemoryExamRepositories } from "./in-memory-exam-repositories";

const OWNER = "owner-1";

// The fakes have no pages or generations table and no foreign keys: any
// fresh id is a valid generation id, and `pageOwners` plays the pages
// table for the page-state ownership check.
const pageOwners = new Map<string, string>();

runExamRepositoriesContract({
  createRepositories: () =>
    createInMemoryExamRepositories({
      isPageOwnedBy: (pageId, ownerId) => pageOwners.get(pageId) === ownerId,
    }),
  context: () => ({
    ownerId: OWNER,
    otherOwnerId: "owner-2",
    newId: () => randomUUID(),
    newPageId: async () => {
      const id = randomUUID();
      pageOwners.set(id, OWNER);
      return id;
    },
    newGenerationId: async () => randomUUID(),
  }),
});
