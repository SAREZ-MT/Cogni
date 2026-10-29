import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPagePickerTree } = vi.hoisted(() => ({
  getPagePickerTree: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({ getPagePickerTree }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { loadCreateExamNotebooks } from "./create-exam-notebooks";

describe("loadCreateExamNotebooks", () => {
  beforeEach(() => {
    getPagePickerTree.mockReset();
    captureException.mockReset();
  });

  // Phase 8 H14: each page carries its word count for the 100-word rule.
  it("maps the page picker tree to the dialog's notebooks and pages, with their words", async () => {
    getPagePickerTree.mockResolvedValue([
      {
        id: "nb-1",
        title: "Biología",
        pages: [{ id: "p-1", title: "Mitocondria", words: 140 }],
      },
    ]);

    expect(await loadCreateExamNotebooks()).toEqual([
      {
        id: "nb-1",
        title: "Biología",
        pages: [{ id: "p-1", title: "Mitocondria", words: 140 }],
      },
    ]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("answers null (unknown, not empty) and reports a failed read", async () => {
    const failure = new Error("db down");
    getPagePickerTree.mockRejectedValue(failure);

    expect(await loadCreateExamNotebooks()).toBeNull();
    expect(captureException).toHaveBeenCalledWith(failure);
  });
});
