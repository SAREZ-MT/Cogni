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

  it("hides the due status entirely when no due count is known", () => {
    render(<DeckCard href="/x" tone="info" label="L" cardCount={3} />);

    expect(screen.queryByText("Al día")).not.toBeInTheDocument();
    expect(screen.queryByText(/pendientes/)).not.toBeInTheDocument();
    expect(screen.getByText("3 tarjetas")).toBeInTheDocument();
  });

  it("uses the singular for a single card", () => {
    render(<DeckCard href="/x" tone="info" label="L" cardCount={1} />);

    expect(screen.getByText("1 tarjeta")).toBeInTheDocument();
  });

  it("uses the singular for a single pending card", () => {
    render(
      <DeckCard href="/x" tone="info" label="L" cardCount={4} dueCount={1} />,
    );
    expect(screen.getByText("1 pendiente")).toBeInTheDocument();
  });
});
