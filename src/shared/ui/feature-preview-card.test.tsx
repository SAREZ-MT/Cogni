import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeaturePreviewCard } from "./feature-preview-card";

describe("FeaturePreviewCard", () => {
  it("renders the icon, an h3 title and the description", () => {
    render(
      <FeaturePreviewCard
        icon={<span data-testid="icon" />}
        title="Para hoy"
        description="Los repasos que te tocan hoy."
      />,
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Para hoy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Los repasos que te tocan hoy."),
    ).toBeInTheDocument();
  });

  it("renders the optional trailing adornment next to the icon", () => {
    render(
      <FeaturePreviewCard
        icon={<span />}
        adornment={<span data-testid="adornment" />}
        title="Para hoy"
        description="Copy"
      />,
    );

    expect(screen.getByTestId("adornment")).toBeInTheDocument();
  });

  it("is a static, dashed, non-interactive box", () => {
    const { container } = render(
      <FeaturePreviewCard
        icon={<span />}
        title="Temas débiles"
        description="x"
      />,
    );

    const root = container.firstElementChild;
    expect(root?.className).toContain("border-dashed");
    expect(container.querySelector("a, button")).toBeNull();
  });
});
