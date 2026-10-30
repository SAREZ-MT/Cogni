import { describe, expect, it } from "vitest";
import { navProbeMargin, readNavTheme, resolveNavTheme } from "./nav-theme";

describe("nav theme", () => {
  it("keeps the previous theme while no marked section crosses the probe", () => {
    expect(resolveNavTheme([], "dark")).toBe("dark");
    expect(resolveNavTheme([], "light")).toBe("light");
  });

  it("follows the section under the nav", () => {
    expect(resolveNavTheme([{ theme: "light", order: 2 }], "dark")).toBe(
      "light",
    );
  });

  it("prefers the later section at a boundary where two touch the probe", () => {
    expect(
      resolveNavTheme(
        [
          { theme: "light", order: 3 },
          { theme: "dark", order: 1 },
        ],
        "dark",
      ),
    ).toBe("light");
  });

  it("reads only known themes from the data attribute", () => {
    expect(readNavTheme("dark")).toBe("dark");
    expect(readNavTheme("light")).toBe("light");
    expect(readNavTheme("sepia")).toBeNull();
    expect(readNavTheme(undefined)).toBeNull();
  });

  it("probes a one-pixel line through the middle of the bar", () => {
    expect(navProbeMargin(900, 32)).toBe("-32px 0px -867px 0px");
    expect(navProbeMargin(20, 32)).toBe("-32px 0px 0px 0px");
  });
});
