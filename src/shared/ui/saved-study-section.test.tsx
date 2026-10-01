import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SavedStudySection } from "./saved-study-section";

describe("SavedStudySection", () => {
  it("renders its label and one link per item", () => {
    render(
      <SavedStudySection
        label="Mazo de esta página"
        items={[
          { href: "/a", label: "Uno", detail: "1", tone: "primary" },
          { href: "/b", label: "Dos", detail: "2", tone: "green" },
        ]}
      />,
    );

    expect(screen.getByText("Mazo de esta página")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").map((l) => l.getAttribute("href")),
    ).toEqual(["/a", "/b"]);
  });

  it("renders nothing when the group has no items", () => {
    const { container } = render(
      <SavedStudySection label="Vacío" items={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
