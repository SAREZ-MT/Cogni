import { render, screen, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { emptyView, sampleView } from "../_lib/dashboard-view.fixtures";
import { TechniqueActivity } from "./technique-activity";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(
        children as ReactElement<{ width: number; height: number }>,
        { width: 200, height: 48 },
      ),
  };
});

function card(name: string) {
  return screen.getByRole("figure", {
    name: new RegExp(`^Actividad de ${name}:`),
  });
}

describe("TechniqueActivity", () => {
  it("renders one card per technique", () => {
    render(<TechniqueActivity techniques={sampleView().techniques} />);

    expect(screen.getAllByRole("figure")).toHaveLength(3);
    for (const name of ["Flashcards", "Recordación activa", "Exámenes"]) {
      expect(
        screen.getByRole("heading", { level: 3, name }),
      ).toBeInTheDocument();
    }
  });

  it("describes each card's reviews, streak and accuracy in its figure label", () => {
    render(<TechniqueActivity techniques={sampleView().techniques} />);

    expect(
      screen.getByRole("figure", {
        name: "Actividad de Flashcards: 8 repasos completados en el período, racha de 4 días, 75% de acierto",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", {
        name: "Actividad de Exámenes: 1 repaso completado en el período, racha de 1 día, 50% de acierto",
      }),
    ).toBeInTheDocument();
  });

  it("shows completed reviews with a signed delta vs. the previous period", () => {
    render(<TechniqueActivity techniques={sampleView().techniques} />);

    const flash = within(card("Flashcards"));
    expect(flash.getByText("Repasos completados")).toBeInTheDocument();
    expect(flash.getByText("8")).toBeInTheDocument();
    expect(flash.getByText("+100% vs la semana anterior")).toBeInTheDocument();

    const exams = within(card("Exámenes"));
    expect(exams.getByText("-75% vs la semana anterior")).toBeInTheDocument();
  });

  it("colours a falling delta as an error and a rising one as success", () => {
    render(<TechniqueActivity techniques={sampleView().techniques} />);

    expect(
      within(card("Exámenes")).getByText("-75% vs la semana anterior"),
    ).toHaveClass("text-error-600");
    expect(
      within(card("Flashcards")).getByText("+100% vs la semana anterior"),
    ).toHaveClass("text-success-600");
  });

  it("shows the streak and the accuracy pill", () => {
    render(<TechniqueActivity techniques={sampleView().techniques} />);

    expect(
      within(card("Flashcards")).getByText("Racha · 4 días"),
    ).toBeInTheDocument();
    expect(
      within(card("Flashcards")).getByText("Acierto 75%"),
    ).toBeInTheDocument();
    expect(
      within(card("Recordación activa")).getByText("Acierto 50%"),
    ).toBeInTheDocument();
  });

  it("labels the seven weekdays under each mini chart", () => {
    render(<TechniqueActivity techniques={sampleView().techniques} />);

    expect(within(card("Flashcards")).getAllByText(/^[lmxjvsd]$/)).toHaveLength(
      7,
    );
  });

  it("never shows a study-time metric", () => {
    const { container } = render(
      <TechniqueActivity techniques={sampleView().techniques} />,
    );

    expect(container.textContent).not.toMatch(
      /tiempo de estudio|horas|minutos/i,
    );
  });

  it("shows no delta when the previous period had no reviews", () => {
    render(<TechniqueActivity techniques={sampleView().techniques} />);

    expect(
      within(card("Recordación activa")).queryByText(/vs la semana anterior/),
    ).toBeNull();
  });

  it("shows a dash for accuracy without outcomes", () => {
    render(<TechniqueActivity techniques={emptyView().techniques} />);

    expect(
      within(card("Flashcards")).getByText("Acierto —"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", {
        name: "Actividad de Flashcards: 0 repasos completados en el período, racha de 0 días, sin resultados de acierto",
      }),
    ).toBeInTheDocument();
  });
});
