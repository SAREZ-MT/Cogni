import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FlashcardReviewList } from "./flashcard-review-list";

const cards = [
  { id: "c1", front: "¿Qué es una mitocondria?", back: "Un orgánulo." },
  { id: "c2", front: "¿Qué es el ATP?", back: "Moneda de energía." },
];

describe("FlashcardReviewList", () => {
  it("renders one flip card per card, anchored by the card id", () => {
    const { container } = render(<FlashcardReviewList cards={cards} />);

    expect(screen.getAllByTestId("flip-card")).toHaveLength(2);
    expect(screen.getByText("¿Qué es una mitocondria?")).toBeInTheDocument();
    expect(container.querySelector("#c2")).not.toBeNull();
  });

  it("flips each card independently and never offers grading", async () => {
    const user = userEvent.setup();
    render(<FlashcardReviewList cards={cards} />);
    const [first, second] = screen.getAllByTestId("flip-card");

    await user.click(first as HTMLElement);

    expect(first).toHaveAttribute("data-flipped", "true");
    expect(second).toHaveAttribute("data-flipped", "false");
    expect(screen.queryByText("Otra vez")).not.toBeInTheDocument();
    expect(screen.queryByText(/Califica/)).not.toBeInTheDocument();
  });
});
