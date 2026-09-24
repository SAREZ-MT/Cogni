import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HomeRecentPage } from "@/modules/notebooks";
import { RecentPages } from "./recent-pages";

function page(overrides: Partial<HomeRecentPage> = {}): HomeRecentPage {
  return {
    id: "p1",
    notebookId: "n1",
    notebookTitle: "Biología Celular",
    notebookColor: null,
    title: "Mitocondria y respiración",
    updatedAt: new Date("2026-09-23T10:00:00.000Z"),
    ...overrides,
  };
}

// ui_kits/app/Home Page.html .page-row: page title + notebook name, linked
// to the page route, with a relative "time ago" on the right.
describe("RecentPages", () => {
  it("links each page to its route with the title and notebook name", () => {
    render(
      <RecentPages
        pages={[page()]}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    const link = screen.getByRole("link", {
      name: /Mitocondria y respiración/,
    });
    expect(link).toHaveAttribute("href", "/notebooks/n1/pages/p1");
    expect(screen.getByText("Biología Celular")).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no recent pages", () => {
    render(<RecentPages pages={[]} now={new Date()} />);

    expect(
      screen.getByText("Todavía no hay páginas editadas."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
