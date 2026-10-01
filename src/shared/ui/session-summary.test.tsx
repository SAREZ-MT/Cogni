import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  FeedbackPlaceholder,
  SessionSummary,
  type SessionSummaryProps,
} from "./session-summary";

const STATS = [
  {
    key: "again",
    label: "Otra vez",
    value: 1,
    toneClassName: "text-error-600",
  },
  {
    key: "hard",
    label: "Difícil",
    value: 2,
    toneClassName: "text-warning-600",
  },
  { key: "good", label: "Bien", value: 3, toneClassName: "text-success-600" },
  { key: "easy", label: "Fácil", value: 4, toneClassName: "text-primary-600" },
];

function setup(overrides: Partial<SessionSummaryProps> = {}) {
  const onRestart = vi.fn();
  render(
    <SessionSummary
      title="¡Sesión completada!"
      subtitle="Mi mazo — 10 tarjetas revisadas"
      stats={STATS}
      highlight={<p>Mañana · 7 tarjetas programadas</p>}
      secondaryAction={{ label: "Volver al mazo", href: "/flashcards/nb" }}
      primaryAction={{ label: "Repasar de nuevo →", onClick: onRestart }}
      {...overrides}
    />,
  );
  return onRestart;
}

describe("SessionSummary", () => {
  it("is a modal dialog labelled by the caller's title", () => {
    setup({ title: "Sesión terminada" });

    const dialog = screen.getByRole("dialog", { name: "Sesión terminada" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("renders the caller's subtitle", () => {
    setup();

    expect(
      screen.getByText("Mi mazo — 10 tarjetas revisadas"),
    ).toBeInTheDocument();
  });

  it("shows each stat's value under its label", () => {
    setup();

    const dialog = screen.getByRole("dialog");
    const expected: [string, string][] = [
      ["Otra vez", "1"],
      ["Difícil", "2"],
      ["Bien", "3"],
      ["Fácil", "4"],
    ];
    for (const [label, count] of expected) {
      const tile = within(dialog).getByText(label).parentElement;
      expect(tile).toHaveTextContent(count);
    }
  });

  it("lays out four stats in four columns and three stats in three", () => {
    setup();
    expect(screen.getByText("Otra vez").closest(".grid")).toHaveClass(
      "grid-cols-4",
    );
  });

  it("uses three columns for a three-cell grid", () => {
    setup({ stats: STATS.slice(0, 3) });

    expect(screen.getByText("Otra vez").closest(".grid")).toHaveClass(
      "grid-cols-3",
    );
  });

  it("renders the highlight panel content", () => {
    setup();

    expect(
      screen.getByText("Mañana · 7 tarjetas programadas"),
    ).toBeInTheDocument();
  });

  it("omits the highlight panel when none is given", () => {
    setup({ highlight: undefined });

    expect(screen.queryByText(/Mañana/)).not.toBeInTheDocument();
  });

  it("renders an href action as a link", () => {
    setup();

    expect(
      screen.getByRole("link", { name: "Volver al mazo" }),
    ).toHaveAttribute("href", "/flashcards/nb");
  });

  it("renders an onClick action as a button that fires once", async () => {
    const onRestart = setup();

    await userEvent.click(
      screen.getByRole("button", { name: /Repasar de nuevo/ }),
    );

    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("reserves a 'pronto' feedback placeholder by default", () => {
    setup();

    expect(
      screen.getByText("Retroalimentación de la sesión"),
    ).toBeInTheDocument();
    expect(screen.getByText("pronto")).toBeInTheDocument();
  });

  it("lets the caller replace the feedback slot", () => {
    setup({ feedback: <p>Resumen de IA</p> });

    expect(screen.getByText("Resumen de IA")).toBeInTheDocument();
    expect(
      screen.queryByText("Retroalimentación de la sesión"),
    ).not.toBeInTheDocument();
  });

  it("puts feedback before the highlight by default", () => {
    setup({ feedback: <p>Resumen de IA</p> });

    const feedback = screen.getByText("Resumen de IA");
    const highlight = screen.getByText(/Mañana/);
    expect(
      feedback.compareDocumentPosition(highlight) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("puts the highlight before the feedback when asked", () => {
    setup({ feedback: <p>Resumen de IA</p>, highlightBeforeFeedback: true });

    const feedback = screen.getByText("Resumen de IA");
    const highlight = screen.getByText(/Mañana/);
    expect(
      highlight.compareDocumentPosition(feedback) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders a custom emoji", () => {
    setup({ emoji: "🧠" });

    expect(screen.getByText("🧠")).toBeInTheDocument();
  });
});

describe("FeedbackPlaceholder", () => {
  it("shows the fixed title, the pronto pill and the caller's description", () => {
    render(<FeedbackPlaceholder description="Texto propio" />);

    expect(
      screen.getByText("Retroalimentación de la sesión"),
    ).toBeInTheDocument();
    expect(screen.getByText("pronto")).toBeInTheDocument();
    expect(screen.getByText("Texto propio")).toBeInTheDocument();
  });
});
