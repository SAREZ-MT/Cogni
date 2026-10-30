import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import ExamQuestionsPage from "./page";

const NOTEBOOK = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";

// Phase 8 H18: the questions screen is the edit page now.
describe("ExamQuestionsPage", () => {
  it("redirects to the edit page, keeping the hub marker", async () => {
    await expect(
      ExamQuestionsPage({
        params: Promise.resolve({ notebookId: NOTEBOOK, pageId: PAGE }),
        searchParams: Promise.resolve({ desde: "hub" }),
      }),
    ).rejects.toThrow(
      `NEXT_REDIRECT /exams/${NOTEBOOK}/${PAGE}/editar?desde=hub`,
    );
  });

  it("redirects without a query when not opened from the hub", async () => {
    await expect(
      ExamQuestionsPage({
        params: Promise.resolve({ notebookId: NOTEBOOK, pageId: PAGE }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT /exams/${NOTEBOOK}/${PAGE}/editar`);
  });
});
