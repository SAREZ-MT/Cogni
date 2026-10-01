import { describe, expect, it } from "vitest";
import {
  accuracyRingInsight,
  activityChartInsight,
  activityForRange,
  calibrationRows,
  calibrationZone,
  conceptStrengths,
  conceptWeaknesses,
  DAILY_ACTIVITY,
  DASHBOARD_NOTEBOOKS,
  DASHBOARD_PAGES,
  dominioGlobalInsight,
  heroFeedback,
  itemsVencidosKpi,
  notebookPages,
  notebookProgressRows,
  paginasDominadasKpi,
  rachaRepasosKpi,
  TECHNIQUE_METRICS,
  techniqueRepasosCompletados,
} from "./sample";

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const dayTotal = (d: {
  flashcards: number;
  activeRecall: number;
  exams: number;
}) => d.flashcards + d.activeRecall + d.exams;

describe("dominioGlobalInsight", () => {
  it("averages the three notebooks' latest weekly mastery", () => {
    // (72 + 60 + 48) / 3 = 60
    expect(dominioGlobalInsight().valuePct).toBe(60);
  });

  it("rounds the week-over-week delta of the combined curve to points", () => {
    // previous week (70 + 59 + 44) / 3 = 57.67 → 60 - 57.67 = 2.33 → +2
    expect(dominioGlobalInsight().deltaPts).toBe(2);
  });

  it("returns one bar per page sorted weakest to strongest", () => {
    const { bars } = dominioGlobalInsight();

    expect(bars).toHaveLength(DASHBOARD_PAGES.length);
    expect(bars.map((b) => b.score)).toEqual(
      [...bars.map((b) => b.score)].sort((a, b) => a - b),
    );
    expect(bars[0]).toMatchObject({ id: "apoptosis", level: "nuevo" });
    expect(bars.at(-1)).toMatchObject({
      id: "derivadas-parciales",
      level: "dominado",
    });
  });

  it("does not reorder the shared page list", () => {
    const before = DASHBOARD_PAGES.map((p) => p.id);
    dominioGlobalInsight();
    expect(DASHBOARD_PAGES.map((p) => p.id)).toEqual(before);
  });
});

describe("notebookProgressRows", () => {
  const rows = notebookProgressRows();

  it("lists every notebook in order", () => {
    expect(rows.map((r) => r.notebookId)).toEqual(
      DASHBOARD_NOTEBOOKS.map((n) => n.id),
    );
  });

  it("totals items and due items from the notebook's pages", () => {
    const [bio, calc, hist] = rows;

    expect([bio.itemsTotal, bio.itemsDue]).toEqual([114, 20]);
    expect([calc.itemsTotal, calc.itemsDue]).toEqual([102, 14]);
    expect([hist.itemsTotal, hist.itemsDue]).toEqual([60, 28]);
    for (const row of rows) {
      const pages = notebookPages(row.notebookId);
      expect(row.itemsTotal).toBe(sum(pages.map((p) => p.itemsTotal)));
    }
  });

  it("derives the average score percentage and the mastery level from it", () => {
    const [bio, calc, hist] = rows;

    expect([bio.avgScorePct, bio.level]).toEqual([50, "consolidando"]);
    expect([calc.avgScorePct, calc.level]).toEqual([77, "dominado"]);
    expect([hist.avgScorePct, hist.level]).toEqual([27, "aprendiendo"]);
  });

  it("computes the one-week trend from the weekly curve with its sign", () => {
    expect(rows.map((r) => r.deltaPts)).toEqual([2, 0, 4]);
  });
});

describe("heroFeedback", () => {
  it("reuses the global delta and names the weakest notebook", () => {
    expect(heroFeedback()).toEqual({
      deltaPts: dominioGlobalInsight().deltaPts,
      weakestNotebookTitle: "Historia del Arte",
      weakestLevelLabel: "Aprendiendo",
    });
  });
});

describe("activity", () => {
  it("builds 30 consecutive days ending on the fixture today (vie 25)", () => {
    expect(DAILY_ACTIVITY).toHaveLength(30);
    expect(DAILY_ACTIVITY.at(-1)?.label).toBe("vie 25");
    expect(DAILY_ACTIVITY.at(-1)?.fullLabel).toBe("vie 25 sep");
    expect(DAILY_ACTIVITY.map((d) => d.offset)).toEqual(
      Array.from({ length: 30 }, (_, i) => i - 29),
    );
  });

  it("is deterministic across calls", () => {
    expect(activityChartInsight(7)).toEqual(activityChartInsight(7));
  });

  it.each([7, 15, 30] as const)("slices the last %s days", (range) => {
    const days = activityForRange(range);

    expect(days).toHaveLength(range);
    expect(days.at(-1)).toBe(DAILY_ACTIVITY.at(-1));
  });

  it("flags Mondays and numbers the weeks", () => {
    const mondays = DAILY_ACTIVITY.filter((d) => d.isMonday);

    expect(mondays.map((d) => d.label)).toEqual([
      "lun 31",
      "lun 7",
      "lun 14",
      "lun 21",
    ]);
    expect(mondays.map((d) => d.weekLabel)).toEqual([
      "Sem 1",
      "Sem 2",
      "Sem 3",
      "Sem 4",
    ]);
  });

  it("totals the range across the three techniques", () => {
    const insight = activityChartInsight(7);

    expect(insight.total).toBe(sum(activityForRange(7).map(dayTotal)));
    expect(insight.total).toBe(139);
  });

  it("compares a 7-day window with the 7 days before it", () => {
    const previous = sum(DAILY_ACTIVITY.slice(16, 23).map(dayTotal));
    const insight = activityChartInsight(7);

    expect(insight.deltaPct).toBe(
      Math.round(((insight.total - previous) / previous) * 100),
    );
    expect(insight.deltaPct).toBe(14);
    expect(insight.periodLabel).toBe("la semana anterior");
  });

  it("compares a 15-day window with the 15 days before it", () => {
    const previous = sum(DAILY_ACTIVITY.slice(0, 15).map(dayTotal));
    const insight = activityChartInsight(15);

    expect(insight.deltaPct).toBe(
      Math.round(((insight.total - previous) / previous) * 100),
    );
    expect(insight.deltaPct).toBe(41);
    expect(insight.periodLabel).toBe("el período anterior");
  });

  it("shows growing activity (recency ramp) as a positive delta", () => {
    expect(activityChartInsight(7).deltaPct).toBeGreaterThan(0);
  });
});

describe("technique metrics", () => {
  it("counts completed reviews as the sum of the weekly activity", () => {
    expect(TECHNIQUE_METRICS.map(techniqueRepasosCompletados)).toEqual([
      35, 27, 9,
    ]);
  });

  it("weights the overall accuracy by review volume and rounds it", () => {
    // (84*35 + 71*27 + 63*9) / 71 = 76.4
    expect(accuracyRingInsight().overallPct).toBe(76);
  });

  it("keeps each technique's signed week-over-week deltas", () => {
    expect(TECHNIQUE_METRICS.map((t) => t.accuracyDeltaPts)).toEqual([
      3, 5, -2,
    ]);
    expect(TECHNIQUE_METRICS.map((t) => t.repasosDeltaPct)).toEqual([
      12, 9, -4,
    ]);
  });

  it("never carries a study-time field", () => {
    for (const metric of TECHNIQUE_METRICS) {
      expect(Object.keys(metric).join(" ")).not.toMatch(/tiempo|time|minutes/i);
    }
  });
});

describe("KPI tiles", () => {
  it("uses the longest technique streak as the review streak", () => {
    expect(rachaRepasosKpi().days).toBe(
      Math.max(...TECHNIQUE_METRICS.map((t) => t.streakDays)),
    );
    expect(rachaRepasosKpi().days).toBe(9);
  });

  it("counts mastered pages (score >= 0.70 with items) and last week's delta", () => {
    expect(paginasDominadasKpi()).toEqual({ value: 7, total: 19, delta: 1 });
  });

  it("sums due items and reports a negative delta when they dropped", () => {
    expect(itemsVencidosKpi()).toEqual({
      due: sum(DASHBOARD_PAGES.map((p) => p.itemsDue)),
      delta: -11,
    });
  });
});

describe("calibrationRows", () => {
  const rows = calibrationRows();
  const byTitle = (title: string) => rows.find((r) => r.pageTitle === title);

  it("returns one row per page averaging its self-evaluated concepts", () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows).toHaveLength(19);
  });

  it("rounds averages to one decimal and computes gap = self - real", () => {
    expect(byTitle("Renacimiento")).toMatchObject({
      selfAvg: 2.5,
      aiAvg: 4.5,
      gap: -2,
    });
    expect(byTitle("Cloroplasto")).toMatchObject({ gap: 4 });
  });

  it("flags overconfidence at self >= 4 and real <= 2 (§7.4)", () => {
    expect(byTitle("Cloroplasto")?.zone).toBe("exceso");
    expect(byTitle("Bauhaus")?.zone).toBe("exceso");
  });

  it("flags underconfidence at self <= 1 and real >= 4 (§7.4)", () => {
    expect(byTitle("Núcleo")?.zone).toBe("falta");
    expect(byTitle("Derivadas parciales")?.zone).toBe("falta");
  });

  it("keeps everything else calibrated, including the boundaries", () => {
    // self 4 / real 5 and self 1 / real 1 sit outside both rules.
    expect(byTitle("Multiplicadores de Lagrange")?.zone).toBe("calibrado");
    expect(byTitle("Apoptosis")?.zone).toBe("calibrado");
  });

  it("links each row to its active recall session", () => {
    expect(byTitle("Cloroplasto")?.href).toBe(
      "/active-recall/biologia-celular/cloroplasto",
    );
  });
});

describe("calibrationZone (documento-maestro §7.4)", () => {
  it.each([
    [4, 2, "exceso"],
    [5, 1, "exceso"],
    [4, 3, "calibrado"],
    [3.9, 2, "calibrado"],
    [1, 4, "falta"],
    [0, 5, "falta"],
    [1, 3.9, "calibrado"],
    [1.1, 4, "calibrado"],
    [3, 3, "calibrado"],
  ])("self %s vs real %s is %s", (self, ai, zone) => {
    expect(calibrationZone(self, ai)).toBe(zone);
  });
});

describe("concept rankings", () => {
  it("lists the strongest concepts first, capped at the limit", () => {
    const strengths = conceptStrengths();

    expect(strengths).toHaveLength(5);
    expect(strengths.map((c) => c.percent)).toEqual([95, 92, 90, 88, 85]);
    expect(conceptStrengths(2)).toHaveLength(2);
  });

  it("lists the weakest concepts first, capped at the limit", () => {
    const weaknesses = conceptWeaknesses();

    expect(weaknesses.map((c) => c.percent)).toEqual([20, 28, 31, 34, 40]);
    expect(conceptWeaknesses(1)).toHaveLength(1);
  });

  it("describes where each concept lives and links to its page", () => {
    expect(conceptStrengths()[0]).toMatchObject({
      label: "Perspectiva lineal",
      meta: "Historia del Arte · Renacimiento",
      href: "/notebooks/historia-del-arte/pages/renacimiento",
    });
  });
});
