import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyView, sampleView } from "../_lib/dashboard-view.fixtures";
import { MasteryInsight } from "./mastery-insight";

describe("MasteryInsight", () => {
  it("shows the current global mastery percentage", () => {
    render(<MasteryInsight mastery={sampleView().mastery} />);

    expect(screen.getByText("Dominio global")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("shows no week-over-week change (no mastery history)", () => {
    const { container } = render(
      <MasteryInsight mastery={sampleView().mastery} />,
    );

    expect(container.textContent).not.toMatch(/semana pasada|pts/);
  });

  it("renders one strip bar per page", () => {
    render(<MasteryInsight mastery={sampleView().mastery} />);

    expect(
      screen.getByRole("img", { name: "Dominio por página: 4 páginas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: /Dominio global:/ }),
    ).toBeInTheDocument();
  });

  it("shows a dash without pages with items", () => {
    render(<MasteryInsight mastery={emptyView().mastery} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(
      screen.getByText("Aún no hay páginas con ítems"),
    ).toBeInTheDocument();
  });
});
