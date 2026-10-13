import { randomUUID } from "node:crypto";
import {
  type AnalyticsReadersContractContext,
  runAnalyticsReadersContract,
} from "./analytics-readers.contract";
import { InMemoryAnalyticsStore } from "./in-memory-analytics-store";

// The fake is its own seed: the contract's fixtures are written straight
// into it, standing in for the tables the Drizzle readers join.
let store = new InMemoryAnalyticsStore();
let nextPosition = 1;

const context = (): AnalyticsReadersContractContext => ({
  ownerId: "owner-1",
  otherOwnerId: "owner-2",
  newPage: async ({ ownerId = "owner-1", sameNotebookAs } = {}) => {
    const notebook = sameNotebookAs ?? {
      notebookId: randomUUID(),
      notebookTitle: "Cuaderno del contrato",
      notebookColor: "green",
    };
    if (!sameNotebookAs) {
      store.addNotebook({
        id: notebook.notebookId,
        ownerId,
        title: notebook.notebookTitle,
        color: notebook.notebookColor,
        position: nextPosition++,
      });
    }
    const fixture = {
      pageId: randomUUID(),
      pageTitle: `Página ${randomUUID().slice(0, 8)}`,
      notebookId: notebook.notebookId,
      notebookTitle: notebook.notebookTitle,
      notebookColor: notebook.notebookColor,
    };
    store.addPage({
      id: fixture.pageId,
      ownerId,
      notebookId: fixture.notebookId,
      title: fixture.pageTitle,
      position: nextPosition++,
    });
    return fixture;
  },
  addItem: async (page, input) =>
    store.addItem({
      pageId: page.pageId,
      dueAt: input.dueAt,
      suspended: input.suspended ?? false,
    }),
  setMastery: async (page, input) => store.setMastery(page.pageId, input),
  addReview: async (page, input) =>
    store.addReview({ pageId: page.pageId, ...input }),
  addExamAnswer: async (page, input) =>
    store.addExamAnswer({
      pageId: page.pageId,
      isCorrect: input.isCorrect,
      answeredAt: input.answeredAt,
      finished: input.finished ?? true,
    }),
  addRecallAnswer: async (page, input) =>
    store.addRecallAnswer({ pageId: page.pageId, ...input }),
  archivePage: async (page) => store.archivePage(page.pageId),
  archiveNotebook: async (page) => store.archiveNotebook(page.notebookId),
});

const createReaders = () => {
  store = new InMemoryAnalyticsStore();
  return { reviews: store, pages: store, answers: store };
};

runAnalyticsReadersContract({ createReaders, context });
