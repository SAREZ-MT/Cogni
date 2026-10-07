import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSidebarTree } = vi.hoisted(() => ({ getSidebarTree: vi.fn() }));
vi.mock("@/modules/notebooks", () => ({ getSidebarTree }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { loadCreateExamNotebooks } from "./create-exam-notebooks";

describe("loadCreateExamNotebooks", () => {
  beforeEach(() => {
    getSidebarTree.mockReset();
    captureException.mockReset();
  });

  it("maps the sidebar tree to the dialog's notebooks and pages", async () => {
    getSidebarTree.mockResolvedValue([
      {
        id: "nb-1",
        title: "Biología",
        color: "violet",
        pages: [{ id: "p-1", title: "Mitocondria", position: 0 }],
      },
    ]);

    expect(await loadCreateExamNotebooks()).toEqual([
      {
        id: "nb-1",
        title: "Biología",
        pages: [{ id: "p-1", title: "Mitocondria" }],
      },
    ]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("answers null (unknown, not empty) and reports a failed read", async () => {
    const failure = new Error("db down");
    getSidebarTree.mockRejectedValue(failure);

    expect(await loadCreateExamNotebooks()).toBeNull();
    expect(captureException).toHaveBeenCalledWith(failure);
  });
});
