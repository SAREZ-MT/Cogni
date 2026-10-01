import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamPageCard, type ExamPageCardProps } from "./exam-page-card";

const BASE: ExamPageCardProps = {
  notebookId: "nb",
  pageId: "p",
  pageTitle: "Mitocondria",
  questionCount: 10,
  attempts: 2,
  lastScore: 83,
  retakePending: false,
  lastDate: "22 sept",
};

describe("ExamPageCard", () => {
  it("sends a never-attempted page to a fresh session", () => {
    render(<ExamPageCard {...BASE} attempts={0} lastScore={null} />);

    expect(screen.getByRole("link", { name: "Mitocondria" })).toHaveAttribute(
      "href",
      "/exams/nb/p",
    );
  });

  it("sends a passed page to its stored results instead of re-running the exam", () => {
    render(<ExamPageCard {...BASE} />);

    expect(screen.getByRole("link", { name: "Mitocondria" })).toHaveAttribute(
      "href",
      "/exams/nb/p/resultados",
    );
  });

  it("sends a retake-pending page to the retake question set, never the plain session", () => {
    render(<ExamPageCard {...BASE} lastScore={60} retakePending />);

    expect(screen.getByRole("link", { name: "Mitocondria" })).toHaveAttribute(
      "href",
      "/exams/nb/p?retake=1",
    );
  });

  it("links the question management screen with the question count", () => {
    render(<ExamPageCard {...BASE} questionCount={7} />);

    expect(screen.getByRole("link", { name: "Preguntas (7)" })).toHaveAttribute(
      "href",
      "/exams/nb/p/preguntas",
    );
  });

  it("shows title, question count, attempts and the last date", () => {
    render(<ExamPageCard {...BASE} />);

    expect(screen.getByText("Mitocondria")).toBeInTheDocument();
    expect(screen.getByText("10 preguntas · 2 intentos")).toBeInTheDocument();
    expect(screen.getByText("22 sept")).toBeInTheDocument();
  });

  it("uses the singular for a single attempt", () => {
    render(<ExamPageCard {...BASE} attempts={1} />);

    expect(screen.getByText("10 preguntas · 1 intento")).toBeInTheDocument();
  });

  it("shows 'Sin intentar' and the start CTA for a page never attempted", () => {
    render(
      <ExamPageCard
        {...BASE}
        attempts={0}
        lastScore={null}
        lastDate={undefined}
      />,
    );

    expect(screen.getByText("Sin intentar")).toBeInTheDocument();
    expect(screen.getByText("Presentar examen →")).toBeInTheDocument();
  });

  it("shows the score and 'Ver resultados' for a passed page", () => {
    render(<ExamPageCard {...BASE} />);

    expect(screen.getByText("83 %")).toBeInTheDocument();
    expect(screen.getByText("Ver resultados →")).toBeInTheDocument();
    expect(screen.queryByText("Repetir pendiente")).not.toBeInTheDocument();
  });

  it("flags a pending retake with its own pill and CTA, keeping the score", () => {
    render(<ExamPageCard {...BASE} lastScore={60} retakePending />);

    expect(screen.getByText("60 %")).toBeInTheDocument();
    expect(screen.getByText("Repetir pendiente")).toBeInTheDocument();
    expect(screen.getByText("Repetir examen →")).toBeInTheDocument();
  });

  it.each([
    [80, "text-success-600"],
    [79, "text-warning-600"],
    [60, "text-warning-600"],
    [59, "text-error-600"],
  ])("colours a %s score with %s", (score, className) => {
    render(<ExamPageCard {...BASE} lastScore={score} />);

    expect(screen.getByText(`${score} %`)).toHaveClass(className);
  });
});
