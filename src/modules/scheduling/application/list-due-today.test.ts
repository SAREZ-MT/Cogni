import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import type { DueTodayPage } from "../domain/due-today";
import { listDueToday } from "./list-due-today";

const NOW = new Date("2026-10-04T12:00:00.000Z");

describe("listDueToday", () => {
  it("reads the owner's due pages at the injected clock's now", async () => {
    const rows: DueTodayPage[] = [
      {
        pageId: "p1",
        pageTitle: "Mitosis",
        notebookId: "n1",
        notebookTitle: "Biología",
        notebookColor: "green",
        due: { flashcard: 3, exam_question: 0, recall_question: 0 },
        earliestDueAt: new Date("2026-10-03T08:00:00.000Z"),
      },
    ];
    const reader = { listDueToday: vi.fn().mockResolvedValue(rows) };

    const result = await listDueToday("owner-1", {
      reader,
      clock: createFixedClock(NOW),
    });

    expect(reader.listDueToday).toHaveBeenCalledWith("owner-1", NOW);
    expect(result).toEqual(rows);
  });
});
