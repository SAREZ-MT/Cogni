import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryDueTodayReader } from "./application/testing/in-memory-due-today-reader";

// Session, database and Sentry are mocked so this proves the Server Action
// boundary (session first, owner scoping, never throws) without Postgres;
// the reader itself is covered by its shared contract.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

let reader: InMemoryDueTodayReader;
vi.mock("./infrastructure", () => ({
  DrizzleDueTodayReader: class {
    listDueToday(ownerId: string, now: Date) {
      return reader.listDueToday(ownerId, now);
    }
  },
}));

import { listDueTodayAction } from "./actions";

const NOW = new Date("2026-10-04T12:00:00.000Z");

function seedPage(id: string, ownerId: string, dueAt: Date) {
  reader.addNotebook({
    id: `nb-${id}`,
    ownerId,
    title: "Biología",
    color: "green",
  });
  reader.addPage({ id, ownerId, notebookId: `nb-${id}`, title: "Mitosis" });
  reader.addItem({ pageId: id, kind: "flashcard", dueAt, suspended: false });
}

describe("listDueTodayAction", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    reader = new InMemoryDueTodayReader();
    getCurrentUser.mockReset();
    captureException.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires a session", async () => {
    getCurrentUser.mockResolvedValue(null);
    const result = await listDueTodayAction();
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_SESSION_REQUIRED" }),
    });
  });

  it("lists only the caller's pages with items due at or before now", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    seedPage("p-due", "owner-1", new Date(NOW.getTime() - 1000));
    seedPage("p-later", "owner-1", new Date(NOW.getTime() + 1000));
    seedPage("p-other", "owner-2", new Date(NOW.getTime() - 1000));

    const result = await listDueTodayAction();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((page) => page.pageId)).toEqual(["p-due"]);
    expect(result.value[0]).toMatchObject({
      pageTitle: "Mitosis",
      notebookId: "nb-p-due",
      notebookTitle: "Biología",
      due: { flashcard: 1, exam_question: 0, recall_question: 0 },
    });
  });

  it("never throws: an infrastructure failure becomes an ActionError", async () => {
    getCurrentUser.mockResolvedValue({ id: "owner-1" });
    vi.spyOn(reader, "listDueToday").mockRejectedValue(new Error("db down"));

    const result = await listDueTodayAction();

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SCHEDULING_UNEXPECTED" }),
    });
    expect(captureException).toHaveBeenCalled();
  });
});
