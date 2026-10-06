import { randomUUID } from "node:crypto";
import { runExamHubReaderContract } from "./exam-hub-reader.contract";
import {
  InMemoryExamHubReader,
  type InMemoryHubPage,
} from "./in-memory-exam-hub-reader";
import { createInMemoryExamRepositories } from "./in-memory-exam-repositories";

const OWNER = "owner-1";

// The fake has no pages or notebooks tables: `directory` plays both.
const directory = new Map<string, InMemoryHubPage>();

runExamHubReaderContract({
  createFixture: () => {
    const repositories = createInMemoryExamRepositories({
      isPageOwnedBy: (pageId, ownerId) =>
        directory.get(pageId)?.ownerId === ownerId,
    });
    return {
      repositories,
      reader: new InMemoryExamHubReader(repositories, (pageId) =>
        directory.get(pageId),
      ),
    };
  },
  context: () => ({
    ownerId: OWNER,
    otherOwnerId: "owner-2",
    newId: () => randomUUID(),
    newPage: async (input = {}) => {
      const page: InMemoryHubPage = {
        pageId: randomUUID(),
        pageTitle: input.pageTitle ?? `Página ${randomUUID().slice(0, 8)}`,
        notebookId: randomUUID(),
        notebookTitle: input.notebookTitle ?? "Cuaderno del contrato",
        notebookColor: "green",
        ownerId: input.ownerId ?? OWNER,
        archived: false,
      };
      directory.set(page.pageId, page);
      const { ownerId: _owner, archived: _archived, ...fixture } = page;
      return fixture;
    },
    archivePage: async (page) => {
      const stored = directory.get(page.pageId);
      if (stored) directory.set(page.pageId, { ...stored, archived: true });
    },
    archiveNotebook: async (page) => {
      for (const [id, stored] of directory) {
        if (stored.notebookId === page.notebookId) {
          directory.set(id, { ...stored, archived: true });
        }
      }
    },
    newGenerationId: async () => randomUUID(),
  }),
});
