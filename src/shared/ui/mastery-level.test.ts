import { describe, expect, it } from "vitest";
import {
  CONSOLIDATING_THRESHOLD,
  MASTERED_THRESHOLD,
} from "@/shared/kernel/mastery-thresholds";
import {
  MASTERY_LEVEL_LABEL,
  MASTERY_LEVEL_SOLID_CLASS,
  MASTERY_LEVELS,
  masteryLevelFromScore,
} from "./mastery-level";

describe("masteryLevelFromScore (documento-maestro §7.3)", () => {
  it("is nuevo whenever the page has no items, whatever the score", () => {
    expect(masteryLevelFromScore(0, 0)).toBe("nuevo");
    expect(masteryLevelFromScore(0.95, 0)).toBe("nuevo");
  });

  it.each([
    [0, "aprendiendo"],
    [0.34, "aprendiendo"],
    [0.35, "consolidando"],
    [0.69, "consolidando"],
    [0.7, "dominado"],
    [1, "dominado"],
  ] as const)("maps score %s to %s", (score, level) => {
    expect(masteryLevelFromScore(score, 10)).toBe(level);
  });
});

describe("masteryLevelFromScore thresholds", () => {
  it("switches band exactly at the shared kernel thresholds", () => {
    expect(masteryLevelFromScore(CONSOLIDATING_THRESHOLD, 10)).toBe(
      "consolidando",
    );
    expect(masteryLevelFromScore(MASTERED_THRESHOLD, 10)).toBe("dominado");
  });
});

describe("mastery vocabulary", () => {
  it("orders the levels from nuevo to dominado", () => {
    expect(MASTERY_LEVELS).toEqual([
      "nuevo",
      "aprendiendo",
      "consolidando",
      "dominado",
    ]);
  });

  it("labels and colours every level", () => {
    for (const level of MASTERY_LEVELS) {
      expect(MASTERY_LEVEL_LABEL[level]).toMatch(/\S/);
      expect(MASTERY_LEVEL_SOLID_CLASS[level]).toMatch(/\S/);
    }
    expect(MASTERY_LEVEL_LABEL.consolidando).toBe("Consolidando");
  });

  it("never colours two levels the same", () => {
    expect(new Set(Object.values(MASTERY_LEVEL_SOLID_CLASS)).size).toBe(4);
  });
});
