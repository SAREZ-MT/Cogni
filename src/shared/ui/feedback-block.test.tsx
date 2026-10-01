import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedbackBlock } from "./feedback-block";

describe("FeedbackBlock", () => {
  it("shows the eyebrow label and the content", () => {
    render(
      <FeedbackBlock eyebrowLabel="Tu respuesta">Produce ATP</FeedbackBlock>,
    );

    expect(screen.getByText("Tu respuesta")).toBeInTheDocument();
    expect(screen.getByText("Produce ATP")).toBeInTheDocument();
  });

  it("is neutral by default and success-toned on request", () => {
    const { rerender, container } = render(
      <FeedbackBlock eyebrowLabel="E">x</FeedbackBlock>,
    );
    expect(screen.getByText("E")).toHaveClass("text-fg-muted");
    expect(container.firstChild).toHaveClass("bg-card");

    rerender(
      <FeedbackBlock eyebrowLabel="E" tone="success">
        x
      </FeedbackBlock>,
    );
    expect(screen.getByText("E")).toHaveClass("text-success-600");
    expect(container.firstChild).toHaveClass("bg-success-50/50");
  });

  it("merges a caller className", () => {
    const { container } = render(
      <FeedbackBlock eyebrowLabel="E" className="mt-7">
        x
      </FeedbackBlock>,
    );

    expect(container.firstChild).toHaveClass("mt-7");
  });
});
