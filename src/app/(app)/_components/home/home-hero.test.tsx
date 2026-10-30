import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeHero } from "./home-hero";

describe("HomeHero illustration", () => {
  // The illustration is hidden below lg, so it must not be preloaded (a
  // preload link would fetch it on phones too). Next 16 deprecates
  // `priority` and recommends fetchPriority="high" for the above-the-fold
  // image; with the default lazy loading the hidden copy is never fetched.
  it("loads with high fetch priority, lazily, without a preload", () => {
    const { container } = render(
      <HomeHero
        displayName="Ana"
        dateLabel="Domingo 18 de octubre"
        streak={null}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("fetchpriority")).toBe("high");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });
});
