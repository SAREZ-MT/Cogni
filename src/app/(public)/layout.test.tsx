import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PublicLayout from "./layout";

// connection() only resolves inside a Next.js request; outside one the
// layout renders as it would per request.
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));

describe("PublicLayout", () => {
  it("shows the Cogni brand above the form for small screens", async () => {
    render(await PublicLayout({ children: <p>form</p> }));

    const mobileBrand = screen.getByTestId("public-mobile-brand");
    expect(mobileBrand).toHaveTextContent("Cogni");
    expect(mobileBrand).toHaveClass("md:hidden");
  });

  it("keeps the product showcase decorative", async () => {
    render(await PublicLayout({ children: <p>form</p> }));

    expect(screen.getByTestId("public-showcase")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("keeps the static gradient (no canvas) when the panel is not shown", async () => {
    render(await PublicLayout({ children: <p>form</p> }));

    const showcase = screen.getByTestId("public-showcase");
    expect(showcase).toHaveAttribute("data-canvas-state", "disabled");
    expect(showcase.querySelector("canvas")).toBeNull();
  });
});
