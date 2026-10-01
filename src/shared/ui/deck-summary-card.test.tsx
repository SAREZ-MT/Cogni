import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeckSummaryCard } from "./deck-summary-card";

describe("DeckSummaryCard", () => {
  it("links to its href with the notebook title and card count", () => {
    render(
      <DeckSummaryCard
        href="/flashcards/biologia"
        tone="purple"
        title="Biología Celular"
        cardCount={20}
        dueCount={0}
      />,
    );

    const link = screen.getByRole("link", { name: /Biología Celular/ });
    expect(link).toHaveAttribute("href", "/flashcards/biologia");
    expect(link).toHaveTextContent("20 tarjetas");
  });

  it("shows the due count as a badge and a pending line when cards are due", () => {
    render(
      <DeckSummaryCard
        href="/x"
        tone="blue"
        title="T"
        cardCount={10}
        dueCount={3}
      />,
    );

    expect(screen.getByRole("link")).toHaveTextContent("3 pendientes");
    expect(
      screen.getByText("3", { selector: "span[aria-hidden]" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/al día/)).not.toBeInTheDocument();
  });

  it("shows 'al día' and no badge when nothing is due", () => {
    render(
      <DeckSummaryCard
        href="/x"
        tone="blue"
        title="T"
        cardCount={10}
        dueCount={0}
      />,
    );

    expect(screen.getByText(/al día/)).toBeInTheDocument();
    expect(screen.queryByText(/pendientes/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("0", { selector: "span[aria-hidden]" }),
    ).not.toBeInTheDocument();
  });

  it("tints the header with the notebook color", () => {
    const { container } = render(
      <DeckSummaryCard
        href="/x"
        tone="orange"
        title="T"
        cardCount={1}
        dueCount={0}
      />,
    );

    expect(container.querySelector(".bg-pastel-orange")).not.toBeNull();
  });
});
