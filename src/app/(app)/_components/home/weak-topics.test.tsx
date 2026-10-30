import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/notebooks", () => ({
  COLOR_PALETTE: [
    "pink",
    "green",
    "yellow",
    "purple",
    "orange",
    "blue",
    "mint",
  ],
}));

import { accuracySeverity, WeakTopics } from "./weak-topics";

const topic = (pageId: string, accuracy: number) => ({
  pageId,
  pageTitle: `Página ${pageId}`,
  notebookId: "n1",
  notebookTitle: "Biología",
  notebookColor: "green",
  accuracy,
  attempts: 5,
});

describe("accuracySeverity", () => {
  it("is high under 40% and medium for the rest of the weak range", () => {
    expect(accuracySeverity(0)).toBe("high");
    expect(accuracySeverity(0.39)).toBe("high");
    expect(accuracySeverity(0.4)).toBe("medium");
    expect(accuracySeverity(0.69)).toBe("medium");
  });
});

describe("WeakTopics", () => {
  it("colours each bar by severity and always writes the percentage", () => {
    render(<WeakTopics topics={[topic("a", 0.2), topic("b", 0.6)]} />);

    expect(screen.getByText("20%")).toHaveClass("text-error-600");
    expect(screen.getByText("60%")).toHaveClass("text-warning-700");
    expect(
      screen.getByRole("progressbar", {
        name: "20% de acierto en 5 respuestas",
      }),
    ).toBeInTheDocument();
  });

  // H2-T5j: the section now sits in Home's wide main column, so the list
  // uses two columns and the empty state is one compact line.
  it("lays the topics out in two columns from sm", () => {
    render(<WeakTopics topics={[topic("a", 0.2), topic("b", 0.6)]} />);

    expect(screen.getByRole("list")).toHaveClass("sm:grid-cols-2");
  });

  it("shows a compact friendly empty state without topics", () => {
    const { container } = render(<WeakTopics topics={[]} />);

    expect(screen.getByText("Aún no hay temas débiles")).toBeInTheDocument();
    expect(container.querySelector('[data-part="empty"]')).toHaveClass(
      "flex-row",
    );
  });

  it("says when the read failed", () => {
    render(<WeakTopics topics={null} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar tus temas débiles.",
    );
  });
});
