import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicLayout from "./layout";

describe("PublicLayout", () => {
  it("shows the Cogni brand above the form for small screens", () => {
    render(
      <PublicLayout>
        <p>form</p>
      </PublicLayout>,
    );

    const mobileBrand = screen.getByTestId("public-mobile-brand");
    expect(mobileBrand).toHaveTextContent("Cogni");
    expect(mobileBrand).toHaveClass("md:hidden");
  });

  it("keeps the product showcase decorative", () => {
    render(
      <PublicLayout>
        <p>form</p>
      </PublicLayout>,
    );

    expect(screen.getByTestId("public-showcase")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("keeps the static gradient (no canvas) when the panel is not shown", () => {
    render(
      <PublicLayout>
        <p>form</p>
      </PublicLayout>,
    );

    const showcase = screen.getByTestId("public-showcase");
    expect(showcase).toHaveAttribute("data-canvas-state", "disabled");
    expect(showcase.querySelector("canvas")).toBeNull();
  });
});
