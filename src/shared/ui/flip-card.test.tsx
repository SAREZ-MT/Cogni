import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FlipCard } from "./flip-card";

describe("FlipCard", () => {
  it("renders both faces with their default eyebrows", () => {
    render(
      <FlipCard front="¿Qué?" back="Eso" flipped={false} onToggle={() => {}} />,
    );

    expect(screen.getByText("¿Qué?")).toBeInTheDocument();
    expect(screen.getByText("Eso")).toBeInTheDocument();
    expect(screen.getByText("Frente · Pregunta")).toBeInTheDocument();
    expect(screen.getByText("Reverso · Respuesta")).toBeInTheDocument();
  });

  it("exposes the flipped state to assistive tech", () => {
    const { rerender } = render(
      <FlipCard front="a" back="b" flipped={false} onToggle={() => {}} />,
    );
    const card = screen.getByTestId("flip-card");
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(card).toHaveAttribute("data-flipped", "false");

    rerender(<FlipCard front="a" back="b" flipped onToggle={() => {}} />);
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card).toHaveAttribute("data-flipped", "true");
  });

  it("asks the caller to toggle on click and on keyboard activation", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<FlipCard front="a" back="b" flipped={false} onToggle={onToggle} />);

    await user.click(screen.getByTestId("flip-card"));
    screen.getByTestId("flip-card").focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onToggle).toHaveBeenCalledTimes(3);
  });

  it("accepts custom eyebrows and hints", () => {
    render(
      <FlipCard
        front="a"
        back="b"
        flipped={false}
        onToggle={() => {}}
        frontEyebrow="Pregunta X"
        backEyebrow="Respuesta X"
        frontHint="pista 1"
        backHint="pista 2"
      />,
    );

    for (const text of ["Pregunta X", "Respuesta X", "pista 1", "pista 2"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});
