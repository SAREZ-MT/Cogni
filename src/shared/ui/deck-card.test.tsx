import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeckCard } from "./deck-card";

describe("DeckCard", () => {
  it("links to its href and shows the label and card count", () => {
    render(
      <DeckCard
        href="/flashcards/nb/session?deck=d"
        tone="info"
        label="Membrana celular"
        cardCount={12}
        dueCount={0}
      />,
    );

    const link = screen.getByRole("link", { name: /Membrana celular/ });
    expect(link).toHaveAttribute("href", "/flashcards/nb/session?deck=d");
    expect(link).toHaveTextContent("12 tarjetas");
  });

  it("shows the pending count when cards are due", () => {
    render(
      <DeckCard
        href="/x"
        tone="warning"
        label="L"
        cardCount={8}
        dueCount={5}
      />,
    );

    expect(screen.getByText("5 pendientes")).toBeInTheDocument();
    expect(screen.queryByText("Al día")).not.toBeInTheDocument();
  });

  it("shows 'Al día' when nothing is due", () => {
    render(
      <DeckCard
        href="/x"
        tone="success"
        label="L"
        cardCount={8}
        dueCount={0}
      />,
    );

    expect(screen.getByText("Al día")).toBeInTheDocument();
    expect(screen.queryByText(/pendientes/)).not.toBeInTheDocument();
  });
});
