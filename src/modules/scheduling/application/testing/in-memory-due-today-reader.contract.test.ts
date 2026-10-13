import { randomUUID } from "node:crypto";
import { runDueInRangeReaderContract } from "./due-in-range-reader.contract";
import {
  type DueTodayReaderContractContext,
  runDueTodayReaderContract,
} from "./due-today-reader.contract";
import { InMemoryDueTodayReader } from "./in-memory-due-today-reader";

// The fake is its own seed: the contract's fixtures are written straight
// into it, standing in for the notebooks, pages and study_items tables.
let reader = new InMemoryDueTodayReader();

const context = (): DueTodayReaderContractContext => ({
  ownerId: "owner-1",
  otherOwnerId: "owner-2",
  newPage: async (ownerId = "owner-1") => {
    const fixture = {
      pageId: randomUUID(),
      pageTitle: `Página ${randomUUID().slice(0, 8)}`,
      notebookId: randomUUID(),
      notebookTitle: "Cuaderno del contrato",
      notebookColor: "green",
    };
    reader.addNotebook({
      id: fixture.notebookId,
      ownerId,
      title: fixture.notebookTitle,
      color: fixture.notebookColor,
    });
    reader.addPage({
      id: fixture.pageId,
      ownerId,
      notebookId: fixture.notebookId,
      title: fixture.pageTitle,
    });
    return fixture;
  },
  addItem: async (page, input) => {
    reader.addItem({
      pageId: page.pageId,
      kind: input.kind ?? "flashcard",
      dueAt: input.dueAt,
      suspended: input.suspended ?? false,
    });
  },
  archivePage: async (page) => reader.archivePage(page.pageId),
  archiveNotebook: async (page) => reader.archiveNotebook(page.notebookId),
});

const createReader = () => {
  reader = new InMemoryDueTodayReader();
  return reader;
};

runDueTodayReaderContract({ createReader, context });
runDueInRangeReaderContract({ createReader, context });
