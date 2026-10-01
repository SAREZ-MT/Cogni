import { render, screen, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
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
    render(<TechniqueActivity />);

    expect(screen.getAllByRole("figure")).toHaveLength(3);
    for (const name of ["Flashcards", "Active recall", "Exámenes"]) {
      expect(
        screen.getByRole("heading", { level: 3, name }),
      ).toBeInTheDocument();
    }
  });

  it("describes each card's reviews, streak and accuracy in its figure label", () => {
    render(<TechniqueActivity />);

    expect(
      screen.getByRole("figure", {
        name: "Actividad de Flashcards: 35 repasos completados esta semana, racha de 9 días, 84% de acierto",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", {
        name: "Actividad de Exámenes: 9 repasos completados esta semana, racha de 3 días, 63% de acierto",
      }),
    ).toBeInTheDocument();
  });

  it("shows completed reviews with a signed week-over-week delta", () => {
    render(<TechniqueActivity />);

    const flash = within(card("Flashcards"));
    expect(flash.getByText("Repasos completados")).toBeInTheDocument();
    expect(flash.getByText("35")).toBeInTheDocument();
    expect(flash.getByText("+12% vs la semana pasada")).toBeInTheDocument();

    const exams = within(card("Exámenes"));
    expect(exams.getByText("-4% vs la semana pasada")).toBeInTheDocument();
  });

  it("colours a falling delta as an error and a rising one as success", () => {
    render(<TechniqueActivity />);

    expect(
      within(card("Exámenes")).getByText("-4% vs la semana pasada"),
    ).toHaveClass("text-error-600");
    expect(
      within(card("Flashcards")).getByText("+12% vs la semana pasada"),
    ).toHaveClass("text-success-600");
  });

  it("shows the streak and the accuracy pill", () => {
    render(<TechniqueActivity />);

    expect(
      within(card("Flashcards")).getByText("Racha · 9 días"),
    ).toBeInTheDocument();
    expect(
      within(card("Flashcards")).getByText("Acierto 84%"),
    ).toBeInTheDocument();
    expect(
      within(card("Active recall")).getByText("Acierto 71%"),
    ).toBeInTheDocument();
  });

  it("labels the seven weekdays under each mini chart", () => {
    render(<TechniqueActivity />);

    expect(within(card("Flashcards")).getAllByText(/^[lmxjvsd]$/)).toHaveLength(
      7,
    );
  });

  it("never shows a study-time metric", () => {
    const { container } = render(<TechniqueActivity />);

    expect(container.textContent).not.toMatch(
      /tiempo de estudio|horas|minutos/i,
    );
  });
});
