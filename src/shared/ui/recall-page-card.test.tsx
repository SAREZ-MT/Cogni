import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecallPageCard, type RecallPageCardProps } from "./recall-page-card";

const BASE: RecallPageCardProps = {
  href: "/active-recall/nb/p",
  notebookTitle: "Biología celular",
  pageTitle: "Mitocondria",
  lastSessionDate: "24 sept",
  questionCount: 8,
  sessionCount: 2,
  mastery: 80,
  aiCorrect: 6,
  aiPartial: 2,
  aiIncorrect: 1,
};

describe("RecallPageCard", () => {
  it("links to the given href (the latest session's results)", () => {
    render(<RecallPageCard {...BASE} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/active-recall/nb/p",
    );
  });

  it("shows notebook, page, last session date and counts", () => {
    render(<RecallPageCard {...BASE} />);

    expect(screen.getByText("Biología celular")).toBeInTheDocument();
    expect(screen.getByText("Mitocondria")).toBeInTheDocument();
    expect(screen.getByText("24 sept")).toBeInTheDocument();
    expect(screen.getByText("8 preguntas · 2 sesiones")).toBeInTheDocument();
  });

  it("shows the latest mastery and the AI-score breakdown", () => {
    render(<RecallPageCard {...BASE} />);

    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("6✓ · 2~ · 1✗")).toBeInTheDocument();
  });

  it("labels its call to action «Ver resultados →» in the same success pill", () => {
    render(<RecallPageCard {...BASE} />);

    const cta = screen.getByText("Ver resultados →");
    expect(cta).toHaveClass("bg-success-100", "text-success-700");
    expect(screen.queryByText("Repasar →")).toBeNull();
  });

  it("uses the singular for one question", () => {
    render(<RecallPageCard {...BASE} questionCount={1} />);

    expect(screen.getByText("1 pregunta · 2 sesiones")).toBeInTheDocument();
  });

  it("uses the singular for one session", () => {
    render(<RecallPageCard {...BASE} sessionCount={1} />);

    expect(screen.getByText("8 preguntas · 1 sesión")).toBeInTheDocument();
  });

  it.each([
    [70, "text-success-600"],
    [69, "text-warning-600"],
    [40, "text-warning-600"],
    [39, "text-error-600"],
  ])("tones %i%% mastery as %s", (mastery, tone) => {
    render(<RecallPageCard {...BASE} mastery={mastery} />);

    expect(screen.getByText(`${mastery}%`)).toHaveClass(tone);
  });
});
