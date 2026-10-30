import { describe, expect, it } from "vitest";
import { ditherLevel, runsToPath } from "./pixel-tile";

describe("pixel tile", () => {
  it("merges each row of lit cells into one rectangle per run", () => {
    const lit = new Set(["0,0", "1,0", "3,0", "2,1"]);
    expect(runsToPath(4, 2, (c, r) => lit.has(`${c},${r}`))).toBe(
      "M0 0h2v1h-2zM3 0h1v1h-1zM2 1h1v1h-1z",
    );
  });

  it("keeps the light dither step in the top-left corner", () => {
    expect(ditherLevel(27, 27)).toBe(0);
    const light = (c0: number, r0: number) => {
      let n = 0;
      for (let r = r0; r < r0 + 14; r++)
        for (let c = c0; c < c0 + 14; c++) if (ditherLevel(c, r) === 2) n++;
      return n;
    };
    expect(light(0, 0)).toBeGreaterThan(20);
    expect(light(14, 14)).toBe(0);
  });
});
