import { describe, expect, it } from "vitest";
import * as kernelThresholds from "@/shared/kernel/mastery-thresholds";
import {
  CONSOLIDATING_THRESHOLD,
  computeMastery,
  MASTERED_THRESHOLD,
  MASTERY_LEVELS,
} from "./mastery";
import type { Quality } from "./study-item";

const NOW = new Date("2026-01-10T00:00:00.000Z");
const DAY_MS = 86_400_000;

function item(
  overrides: Partial<{
    intervalDays: number;
    lastQuality: Quality | null;
    dueAt: Date;
    suspendedAt: Date | null;
  }> = {},
) {
  return {
    intervalDays: 0,
    lastQuality: null,
    dueAt: NOW,
    suspendedAt: null,
    ...overrides,
  };
}

describe("computeMastery (§7.3)", () => {
  it("exposes the four levels in order", () => {
    expect(MASTERY_LEVELS).toEqual([
      "Nuevo",
      "Aprendiendo",
      "Consolidando",
      "Dominado",
    ]);
  });

  it("returns Nuevo with score 0 when the page has no items", () => {
    expect(computeMastery([], NOW)).toEqual({
      level: "Nuevo",
      score: 0,
      itemsTotal: 0,
      itemsDue: 0,
    });
  });

  it("returns Nuevo when every item is suspended", () => {
    const result = computeMastery(
      [item({ suspendedAt: NOW, intervalDays: 21, lastQuality: 5 })],
      NOW,
    );
    expect(result).toEqual({
      level: "Nuevo",
      score: 0,
      itemsTotal: 0,
      itemsDue: 0,
    });
  });

  it("scores a never-reviewed item as 0 (Aprendiendo)", () => {
    const result = computeMastery([item()], NOW);
    expect(result.score).toBe(0);
    expect(result.level).toBe("Aprendiendo");
    expect(result.itemsTotal).toBe(1);
  });

  it("caps stability at 21 days and scores a mastered item as 1", () => {
    const result = computeMastery(
      [
        item({
          intervalDays: 60,
          lastQuality: 4,
          dueAt: new Date(NOW.getTime() + DAY_MS),
        }),
      ],
      NOW,
    );
    expect(result.score).toBe(1);
    expect(result.level).toBe("Dominado");
  });

  it("averages contributions across active items", () => {
    // Item A: stability 10.5/21 = 0.5, hit 1 -> 0.3 + 0.4 = 0.7
    // Item B: stability 0, hit 0 (q=2) -> 0
    const result = computeMastery(
      [
        item({ intervalDays: 10.5, lastQuality: 4 }),
        item({ intervalDays: 0, lastQuality: 2 }),
      ],
      NOW,
    );
    expect(result.score).toBeCloseTo(0.35, 10);
    expect(result.itemsTotal).toBe(2);
  });

  it("treats score exactly 0.35 as Consolidando (boundary)", () => {
    // stability 0 (interval 0), hit 1 -> 0.4; plus three zero items -> 0.1.
    // Easier: one item with interval 21*(0.35/0.6) and q<3 -> 0.6*0.5833 = 0.35
    const result = computeMastery(
      [item({ intervalDays: 21 * (0.35 / 0.6), lastQuality: 1 })],
      NOW,
    );
    expect(result.score).toBeCloseTo(0.35, 10);
    expect(result.level).toBe("Consolidando");
  });

  it("treats score just below 0.35 as Aprendiendo", () => {
    const result = computeMastery(
      [item({ intervalDays: 21 * (0.349 / 0.6), lastQuality: 1 })],
      NOW,
    );
    expect(result.level).toBe("Aprendiendo");
  });

  it("treats score exactly 0.70 as Dominado (boundary)", () => {
    // stability 0.5 (10.5 days), hit 1 -> 0.3 + 0.4 = 0.7
    const result = computeMastery(
      [item({ intervalDays: 10.5, lastQuality: 3 })],
      NOW,
    );
    expect(result.score).toBeCloseTo(0.7, 10);
    expect(result.level).toBe("Dominado");
  });

  it("treats score just below 0.70 as Consolidando", () => {
    const result = computeMastery(
      [item({ intervalDays: 10.4, lastQuality: 3 })],
      NOW,
    );
    expect(result.level).toBe("Consolidando");
  });

  it("ignores suspended items in score, total and due counts", () => {
    const result = computeMastery(
      [
        item({
          intervalDays: 21,
          lastQuality: 5,
          dueAt: new Date(NOW.getTime() + DAY_MS),
        }),
        item({ intervalDays: 0, lastQuality: 0, suspendedAt: NOW }),
      ],
      NOW,
    );
    expect(result.score).toBe(1);
    expect(result.itemsTotal).toBe(1);
    expect(result.itemsDue).toBe(0);
    expect(result.level).toBe("Dominado");
  });

  it("counts items due at or before now, not later ones", () => {
    const result = computeMastery(
      [
        item({ dueAt: new Date(NOW.getTime() - DAY_MS) }),
        item({ dueAt: NOW }),
        item({ dueAt: new Date(NOW.getTime() + 1) }),
      ],
      NOW,
    );
    expect(result.itemsTotal).toBe(3);
    expect(result.itemsDue).toBe(2);
  });
});

describe("mastery thresholds", () => {
  it("are the shared kernel values (documento-maestro §7.3: 0.35 / 0.70)", () => {
    expect(CONSOLIDATING_THRESHOLD).toBe(
      kernelThresholds.CONSOLIDATING_THRESHOLD,
    );
    expect(MASTERED_THRESHOLD).toBe(kernelThresholds.MASTERED_THRESHOLD);
    expect(kernelThresholds.CONSOLIDATING_THRESHOLD).toBe(0.35);
    expect(kernelThresholds.MASTERED_THRESHOLD).toBe(0.7);
  });
});
