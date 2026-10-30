import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewRow } from "./review-row";

describe("ReviewRow", () => {
  it("shows the title and meta and links the action straight to its URL", () => {
    render(
      <ReviewRow
        icon={<span data-testid="icon" />}
        title="Mitocondria"
        meta={<span>Biología · Flashcards · 3 pendientes</span>}
        href="/flashcards/nb/p?repasar=1"
        actionLabel="Repasar"
        actionAriaLabel="Repasar Flashcards de Mitocondria: 3 pendientes"
      />,
    );

    expect(screen.getByText("Mitocondria")).toBeInTheDocument();
    expect(
      screen.getByText("Biología · Flashcards · 3 pendientes"),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "Repasar Flashcards de Mitocondria: 3 pendientes",
    });
    expect(link).toHaveAttribute("href", "/flashcards/nb/p?repasar=1");
    expect(link).toHaveTextContent("Repasar");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("defaults to the inline layout", () => {
    const { container } = render(
      <ReviewRow
        icon={<span />}
        title="Mitocondria"
        meta="Biología"
        href="/x"
        actionLabel="Repasar"
        actionAriaLabel="Repasar Mitocondria"
      />,
    );

    expect(container.querySelector('[data-slot="review-row"]')).toHaveAttribute(
      "data-layout",
      "inline",
    );
  });

  // H2-T5n (user 2026-10-18, reference "UI/UX Designer · UpRock" list):
  // the whole tile is one link with a neutral border, the round icon, the
  // bold title over the notebook and a chevron; no button and no badge.
  it("renders the tile as one link with icon, title, notebook and a chevron", () => {
    const { container } = render(
      <ReviewRow
        layout="tile"
        icon={<span data-testid="icon" />}
        title="Una página con un título bastante largo"
        meta="Biología celular"
        badge={<span>3 pendientes</span>}
        href="/exams/nb/p"
        actionLabel="Repasar"
        actionAriaLabel="Repasar Examen de Una página: 3 pendientes"
      />,
    );

    const link = screen.getByRole("link", {
      name: "Repasar Examen de Una página: 3 pendientes",
    });
    expect(link).toHaveAttribute("href", "/exams/nb/p");
    expect(link).toHaveAttribute("data-layout", "tile");
    expect(link.className).toMatch(/border-border-subtle/);
    expect(link.className).not.toMatch(/border-(rose|warning|success)-500/);
    expect(link).toContainElement(screen.getByTestId("icon"));
    expect(
      screen.getByText("Una página con un título bastante largo"),
    ).toHaveClass("font-semibold");
    expect(screen.getByText("Biología celular")).toHaveClass("truncate");
    expect(screen.queryByText("3 pendientes")).toBeNull();
    expect(screen.queryByText("Repasar")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
