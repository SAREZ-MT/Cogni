import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudyItemRow } from "./study-item-row";

describe("StudyItemRow", () => {
  it("links to the item's session with its label and detail", () => {
    render(
      <StudyItemRow
        href="/flashcards/nb/page"
        label="Mitocondria"
        detail="8 tarjetas · 5 pendientes"
        tone="primary"
      />,
    );

    const link = screen.getByRole("link", { name: /Mitocondria/ });
    expect(link).toHaveAttribute("href", "/flashcards/nb/page");
    expect(link).toHaveTextContent("8 tarjetas · 5 pendientes");
  });

  it("tints the dot with the item's tone", () => {
    const { container, rerender } = render(
      <StudyItemRow href="/x" label="l" detail="d" tone="green" />,
    );
    expect(container.querySelector(".bg-success-600")).not.toBeNull();

    rerender(<StudyItemRow href="/x" label="l" detail="d" tone="pink" />);
    expect(container.querySelector(".bg-pastel-pink-fg")).not.toBeNull();
  });

  it("forwards an optional test id and native tooltip to the link", () => {
    render(
      <StudyItemRow
        href="/x"
        label="l"
        detail="d"
        tone="primary"
        testId="flashcard-item"
        title="La respuesta"
      />,
    );

    const link = screen.getByTestId("flashcard-item");
    expect(link).toBe(screen.getByRole("link"));
    expect(link).toHaveAttribute("title", "La respuesta");
  });
});
