import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageListRow } from "./page-list-row";

vi.mock("@/modules/notebooks", () => ({
  ArchivePageButton: ({ pageId, title }: { pageId: string; title: string }) => (
    <button type="button" data-testid={`archive-${pageId}`}>
      Archivar {title}
    </button>
  ),
}));

const page = {
  id: "p1",
  title: "Mitosis",
  updatedAt: new Date("2026-09-03T10:00:00.000Z"),
} as never;

describe("PageListRow", () => {
  it("links the title to the page route inside its notebook", () => {
    render(<PageListRow page={page} notebookId="nb1" />);

    expect(screen.getByRole("link", { name: "Mitosis" })).toHaveAttribute(
      "href",
      "/notebooks/nb1/pages/p1",
    );
  });

  it("shows the formatted last update and keeps the archive action", () => {
    render(<PageListRow page={page} notebookId="nb1" />);

    expect(screen.getByText(/^Actualizada /)).toBeInTheDocument();
    expect(screen.getByTestId("archive-p1")).toBeInTheDocument();
  });
});
