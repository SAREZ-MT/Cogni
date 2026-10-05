import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionFeedbackPanel } from "./session-feedback-panel";

const CONTENT = {
  summary: "Buena sesión: recordaste casi todo.",
  strengths: ["La función de la mitocondria"],
  toReinforce: ["Las fases de la mitosis", "La meiosis"],
  nextStepSuggestion: "Repasa la mitosis mañana.",
};

describe("SessionFeedbackPanel", () => {
  it("is a labelled region that announces its changes politely", () => {
    render(<SessionFeedbackPanel state={{ status: "loading" }} />);

    const region = screen.getByRole("region", {
      name: "Retroalimentación de la sesión",
    });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-busy", "true");
  });

  it("says the feedback is on its way while it loads", () => {
    render(<SessionFeedbackPanel state={{ status: "loading" }} />);

    expect(
      screen.getByText("Preparando tu retroalimentación…"),
    ).toBeInTheDocument();
  });

  it("shows the summary, strengths, what to reinforce and the next step", () => {
    render(
      <SessionFeedbackPanel state={{ status: "done", content: CONTENT }} />,
    );

    const region = screen.getByRole("region", {
      name: "Retroalimentación de la sesión",
    });
    expect(region).toHaveAttribute("aria-busy", "false");
    expect(
      within(region).getByText("Buena sesión: recordaste casi todo."),
    ).toBeInTheDocument();
    const strengths = within(region).getByRole("list", {
      name: "Lo que recordaste bien",
    });
    expect(within(strengths).getAllByRole("listitem")).toHaveLength(1);
    const reinforce = within(region).getByRole("list", {
      name: "Conviene reforzar",
    });
    expect(within(reinforce).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(region).getByText("Repasa la mitosis mañana."),
    ).toBeInTheDocument();
  });

  it("leaves out an empty list", () => {
    render(
      <SessionFeedbackPanel
        state={{ status: "done", content: { ...CONTENT, strengths: [] } }}
      />,
    );

    expect(
      screen.queryByRole("list", { name: "Lo que recordaste bien" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Conviene reforzar" }),
    ).toBeInTheDocument();
  });

  it("shows a calm note, never an error, when the feedback is unavailable", () => {
    render(<SessionFeedbackPanel state={{ status: "unavailable" }} />);

    expect(
      screen.getByText(
        "Esta vez no pudimos preparar la retroalimentación. Tu repaso quedó guardado.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
