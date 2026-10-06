import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SavedStudySection } from "./saved-study-section";

describe("SavedStudySection", () => {
  it("renders its label and one link per item", () => {
    render(
      <SavedStudySection
        label="Mazo de esta página"
        items={[
          { href: "/a", label: "Uno", detail: "1", tone: "yellow" },
          { href: "/b", label: "Dos", detail: "2", tone: "green" },
        ]}
      />,
    );

    expect(screen.getByText("Mazo de esta página")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").map((l) => l.getAttribute("href")),
    ).toEqual(["/a", "/b"]);
  });

  it("keeps its label and shows the empty content when given one", () => {
    render(
      <SavedStudySection
        label="Generado en esta página"
        items={[]}
        empty={<p>Nada todavía</p>}
      />,
    );

    expect(screen.getByText("Generado en esta página")).toBeInTheDocument();
    expect(screen.getByText("Nada todavía")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders nothing when the group has no items", () => {
    const { container } = render(
      <SavedStudySection label="Vacío" items={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
