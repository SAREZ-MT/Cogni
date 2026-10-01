import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccuracyRing } from "./accuracy-ring";

describe("AccuracyRing", () => {
  it("shows the volume-weighted overall accuracy in the ring", () => {
    render(<AccuracyRing />);

    expect(
      screen.getByRole("img", { name: "Tasa de acierto: 76%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", {
        name: "Tasa de acierto general y por técnica",
      }),
    ).toBeInTheDocument();
  });

  it("breaks the accuracy down per technique with signed deltas", () => {
    render(<AccuracyRing />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Flashcards");
    expect(items[0]).toHaveTextContent("84%");
    expect(items[0]).toHaveTextContent("3");
    expect(items[2]).toHaveTextContent("Exámenes");
    expect(items[2]).toHaveTextContent("63%");
    expect(items[2]).toHaveTextContent("2");
  });

  it("colours rising techniques as success and falling ones as error", () => {
    render(<AccuracyRing />);

    const [flash, , exams] = screen.getAllByRole("listitem");
    expect(within(flash).getByText("3")).toHaveClass("text-success-600");
    expect(within(exams).getByText("2")).toHaveClass("text-error-600");
  });
});
