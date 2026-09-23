import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

// screenshots/editor.png (S5, odd/tasks/app-shell-restyle.md): the page
// title reads as a large bold heading (type-scale.html's h1: --text-3xl,
// weight 700, --leading-tight) over a meta row that only shows real data
// (Product decision 1) — here the page's own last-edit time.
describe("PageHeader", () => {
  it("renders the page title as a bold h1 at the design system's h1 scale", () => {
    render(
      <PageHeader
        title="Apuntes de biología"
        updatedAt={new Date("2026-09-23T10:00:00.000Z")}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Apuntes de biología",
    });
    expect(heading.className).toContain("text-3xl");
    expect(heading.className).toContain("font-bold");
    expect(heading.className).toContain("leading-tight");
  });

  it("shows the last-edit time in the meta row using formatTimeAgo", () => {
    render(
      <PageHeader
        title="Apuntes de biología"
        updatedAt={new Date("2026-09-23T10:00:00.000Z")}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    expect(screen.getByText("Editada hace 2h")).toBeInTheDocument();
  });

  it("renders a provided status slot in the meta row", () => {
    render(
      <PageHeader
        title="Apuntes de biología"
        updatedAt={new Date("2026-09-23T10:00:00.000Z")}
        now={new Date("2026-09-23T12:00:00.000Z")}
        statusSlot={<span data-testid="custom-status">guardado</span>}
      />,
    );

    expect(screen.getByTestId("custom-status")).toHaveTextContent("guardado");
  });

  it("omits the status slot entirely when none is provided", () => {
    render(
      <PageHeader
        title="Apuntes de biología"
        updatedAt={new Date("2026-09-23T10:00:00.000Z")}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    expect(screen.queryByTestId("custom-status")).not.toBeInTheDocument();
  });
});
