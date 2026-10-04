import { randomUUID } from "node:crypto";
import { runFlashcardRepositoryContract } from "./flashcard-repository.contract";
import {
  InMemoryFlashcardRepository,
  type PageDirectoryEntry,
} from "./in-memory-flashcard-repository";

// The fake has no pages table: the contract's page directory plays it, and
// archiving a page removes it from the directory.
const directory = new Map<string, PageDirectoryEntry>();
const NOTEBOOK_ID = randomUUID();

runFlashcardRepositoryContract({
  createRepository: () =>
    new InMemoryFlashcardRepository((pageId) => directory.get(pageId)),
  context: () => ({
    ownerId: "owner-1",
    otherOwnerId: "owner-2",
    newPageId: async () => {
      const id = randomUUID();
      directory.set(id, {
        notebookId: NOTEBOOK_ID,
        pageTitle: `Página ${id}`,
        notebookTitle: "Cuaderno del contrato",
        notebookColor: "purple",
      });
      return id;
    },
    newId: () => randomUUID(),
    pageInfo: (pageId) => {
      const entry = directory.get(pageId);
      if (!entry) throw new Error("unknown page");
      return entry;
    },
    archivePage: async (pageId) => {
      directory.delete(pageId);
    },
  }),
});
