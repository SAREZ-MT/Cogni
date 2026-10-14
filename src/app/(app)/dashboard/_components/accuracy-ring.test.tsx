import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyView, sampleView } from "../_lib/dashboard-view.fixtures";
import { AccuracyRing } from "./accuracy-ring";

describe("AccuracyRing", () => {
  it("shows the pooled overall accuracy in the ring", () => {
    render(<AccuracyRing accuracy={sampleView().accuracy} />);

    expect(
      screen.getByRole("img", { name: "Tasa de acierto: 64%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", {
        name: "Tasa de acierto general y por técnica",
      }),
    ).toBeInTheDocument();
  });

  it("breaks the accuracy down per technique with unsigned point deltas", () => {
    render(<AccuracyRing accuracy={sampleView().accuracy} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Flashcards");
    expect(items[0]).toHaveTextContent("75%");
    expect(items[0]).toHaveTextContent("25");
    expect(items[1]).toHaveTextContent("Active recall");
    expect(items[2]).toHaveTextContent("Exámenes");
    expect(items[2]).toHaveTextContent("50%");
    expect(items[2]).toHaveTextContent("50");
  });

  it("colours rising techniques as success and falling ones as error", () => {
    render(<AccuracyRing accuracy={sampleView().accuracy} />);

    const [flash, recall, exams] = screen.getAllByRole("listitem");
    expect(within(flash as HTMLElement).getByText("25")).toHaveClass(
      "text-success-600",
    );
    expect(
      within(exams as HTMLElement).getByText("50", { selector: "span.flex" }),
    ).toHaveClass("text-error-600");
    // No previous outcomes: no delta at all.
    expect((recall as HTMLElement).querySelector("svg")).toBeNull();
  });

  it("shows an empty state without any outcome in the period", () => {
    render(<AccuracyRing accuracy={emptyView().accuracy} />);

    expect(screen.getByText("Aún sin resultados")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Tasa de acierto:/ })).toBeNull();
  });
});
