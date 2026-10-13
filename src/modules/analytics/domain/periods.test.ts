import { describe, expect, it } from "vitest";
import { previousRange, splitPeriods } from "./periods";

describe("previousRange", () => {
  it("is the range of the same length right before", () => {
    expect(previousRange("2026-10-07", "2026-10-14")).toEqual({
      fromDay: "2026-09-30",
      toDay: "2026-10-07",
    });
  });
});

describe("splitPeriods", () => {
  const at = (iso: string) => ({ at: new Date(iso) });
  const options = {
    previousFromDay: "2026-10-10",
    fromDay: "2026-10-12",
    toDay: "2026-10-14",
    timeZone: "America/Bogota",
  };

  it("splits facts by their local day into the current and previous ranges", () => {
    const facts = [
      at("2026-10-10T04:59:59Z"), // 9 Oct in Bogotá: before both ranges
      at("2026-10-10T05:00:00Z"), // 10 Oct: previous
      at("2026-10-12T04:00:00Z"), // 11 Oct: previous
      at("2026-10-12T05:00:00Z"), // 12 Oct: current
      at("2026-10-14T04:59:59Z"), // 13 Oct: current
      at("2026-10-14T05:00:00Z"), // 14 Oct: after the range
    ];

    const split = splitPeriods(facts, (fact) => fact.at, options);

    expect(split.previous).toEqual([facts[1], facts[2]]);
    expect(split.current).toEqual([facts[3], facts[4]]);
  });
});
