import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoogleIcon } from "./google-icon";

describe("GoogleIcon", () => {
  it("renders the four-colour G as a decorative inline svg", () => {
    const { container } = render(<GoogleIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("data-slot", "google-icon");
    const fills = Array.from(svg?.querySelectorAll("path") ?? []).map((p) =>
      p.getAttribute("fill"),
    );
    expect(fills).toEqual(["#4285F4", "#34A853", "#FBBC05", "#EA4335"]);
  });
});
