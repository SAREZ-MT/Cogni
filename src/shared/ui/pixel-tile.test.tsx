import { render } from "@testing-library/react";
import { Layers } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ditherLevel, PixelTile } from "./pixel-tile";

describe("PixelTile", () => {
  it("draws a 2px-cell dither in the tone under a crisp glyph", () => {
    const { container } = render(
      <PixelTile tone="yellow" icon={Layers} size={36} />,
    );

    const tile = container.querySelector("[data-slot=pixel-tile]");
    expect(tile).toHaveAttribute("data-tone", "yellow");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveStyle({ width: "36px", height: "36px" });
    const dither = tile?.querySelector("svg[data-part=dither]");
    expect(dither).toHaveAttribute("viewBox", "0 0 18 18");
    expect(dither).toHaveAttribute("shape-rendering", "crispEdges");
    expect(dither?.querySelectorAll("rect, path")).toHaveLength(3);
    expect(tile?.querySelector("svg.lucide")).not.toBeNull();
  });

  it("keeps 2px cells at 48px", () => {
    const { container } = render(
      <PixelTile tone="rose" icon={Layers} size={48} />,
    );

    expect(container.querySelector("svg[data-part=dither]")).toHaveAttribute(
      "viewBox",
      "0 0 24 24",
    );
  });

  it("exposes a tooltip title when given one, and stays decorative otherwise", () => {
    const { container } = render(
      <PixelTile
        tone="green"
        icon={Layers}
        size={48}
        title="Recordación activa"
      />,
    );

    const tile = container.querySelector("[data-slot=pixel-tile]");
    expect(tile).toHaveAttribute("title", "Recordación activa");
  });
});

describe("ditherLevel", () => {
  it("is light near the top left and dark in the bottom right", () => {
    expect(ditherLevel(18, 5, 4)).toBe(2);
    expect(ditherLevel(18, 17, 17)).toBe(0);
  });

  it("is deterministic", () => {
    expect(ditherLevel(24, 7, 11)).toBe(ditherLevel(24, 7, 11));
  });
});
