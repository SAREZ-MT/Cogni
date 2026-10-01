import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

// screenshots/editor.png (S5, odd/tasks/app-shell-restyle.md): PageHeader
// is a dumb layout shell — the title itself is owned by whatever
// `titleSlot` the caller passes (E1, goal doc §1: the real route passes a
// live PageTitleEditor instead of static text) — PageHeader only has to lay
// it out over the meta row (the page's own last-edit time, plus an
// optional status slot for the autosave indicator).
describe("PageHeader", () => {
  it("renders the given titleSlot", () => {
    render(
      <PageHeader
        titleSlot={<h1 data-testid="custom-title">Apuntes de biología</h1>}
        updatedAt={new Date("2026-09-23T10:00:00.000Z")}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    expect(screen.getByTestId("custom-title")).toHaveTextContent(
      "Apuntes de biología",
    );
  });

  it("shows the last-edit time in the meta row using formatTimeAgo", () => {
    render(
      <PageHeader
        titleSlot={<h1>Apuntes de biología</h1>}
        updatedAt={new Date("2026-09-23T10:00:00.000Z")}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    expect(screen.getByText("Editada hace 2h")).toBeInTheDocument();
  });

  it("renders a provided status slot in the meta row", () => {
    render(
      <PageHeader
        titleSlot={<h1>Apuntes de biología</h1>}
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
        titleSlot={<h1>Apuntes de biología</h1>}
        updatedAt={new Date("2026-09-23T10:00:00.000Z")}
        now={new Date("2026-09-23T12:00:00.000Z")}
      />,
    );

    expect(screen.queryByTestId("custom-status")).not.toBeInTheDocument();
  });
});
