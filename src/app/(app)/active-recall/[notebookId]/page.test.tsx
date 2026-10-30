import { describe, expect, it, vi } from "vitest";

const { redirect, notFound } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ redirect, notFound }));

import ActiveRecallNotebookPage from "./page";

const NOTEBOOK = "11111111-1111-4111-8111-111111111111";

// Phase 8 H17 (user-approved flat hubs, 2026-10-29): the notebook level is
// gone; its old address lands on the hub filtered by that notebook.
describe("/active-recall/[notebookId]", () => {
  it("redirects to the hub filtered by the notebook", async () => {
    await expect(
      ActiveRecallNotebookPage({
        params: Promise.resolve({ notebookId: NOTEBOOK }),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT /active-recall?cuaderno=${NOTEBOOK}`);
    expect(redirect).toHaveBeenCalledWith(
      `/active-recall?cuaderno=${NOTEBOOK}`,
    );
  });

  it("answers 404 for something that is not a notebook id", async () => {
    await expect(
      ActiveRecallNotebookPage({
        params: Promise.resolve({ notebookId: "biologia-celular" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
