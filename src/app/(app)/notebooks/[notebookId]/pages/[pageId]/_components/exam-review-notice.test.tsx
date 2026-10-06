import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamReviewNotice } from "./exam-review-notice";

function renderNotice() {
  render(
    <ExamReviewNotice
      failedConcepts={["Función de la mitocondria", "ADN mitocondrial"]}
      examHref="/exams/nb/pg"
    />,
  );
}

describe("ExamReviewNotice", () => {
  it("lists the failed concepts with a retake action", () => {
    renderNotice();

    const notice = screen.getByRole("region", {
      name: "Repasa antes de repetir el examen",
    });
    const concepts = screen.getByRole("list", {
      name: "Conceptos fallados",
    });
    expect(concepts).toHaveTextContent("Función de la mitocondria");
    expect(concepts).toHaveTextContent("ADN mitocondrial");
    expect(notice).toHaveTextContent("Repásalos en esta página");
    expect(
      screen.getByRole("link", { name: "Repetir examen" }),
    ).toHaveAttribute("href", "/exams/nb/pg");
  });

  it("hides for the rest of the visit when dismissed", () => {
    renderNotice();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar aviso" }));

    expect(screen.queryByTestId("exam-review-notice")).not.toBeInTheDocument();
  });
});
