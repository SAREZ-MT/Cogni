import { describe, expect, it } from "vitest";
import {
  buildDashboardView,
  calibrationZoneOf,
  type DashboardSources,
  dashboardRangeDays,
  dayLabels,
  hourIn,
} from "./dashboard-view";
import {
  emptySources,
  sampleCalibration,
  sampleMetrics,
  sampleProgress,
  sampleSources,
} from "./dashboard-view.fixtures";

function view(overrides: Partial<DashboardSources> = {}) {
  return buildDashboardView({ ...sampleSources(), ...overrides });
}

describe("dashboardRangeDays", () => {
  it("covers the last `range` local days, today included, as [from, to)", () => {
    expect(dashboardRangeDays("2026-10-13", 7)).toEqual({
      fromDay: "2026-10-07",
      toDay: "2026-10-14",
    });
    expect(dashboardRangeDays("2026-03-01", 30)).toEqual({
      fromDay: "2026-01-31",
      toDay: "2026-03-02",
    });
  });
});

describe("hourIn", () => {
  it("reads the local hour (0–23) of an instant in a zone", () => {
    const instant = new Date("2026-10-13T03:30:00Z");
    expect(hourIn(instant, "UTC")).toBe(3);
    // Bogotá is UTC−5: still 12 Oct, 22 h.
    expect(hourIn(instant, "America/Bogota")).toBe(22);
    expect(hourIn(new Date("2026-10-13T05:00:00Z"), "America/Bogota")).toBe(0);
  });
});

describe("dayLabels", () => {
  it("names a day by weekday and day of month without the platform locale", () => {
    expect(dayLabels("2026-10-12")).toEqual({
      label: "lun 12",
      fullLabel: "lun 12 oct",
      initial: "l",
      isMonday: true,
    });
    expect(dayLabels("2026-10-18")).toMatchObject({
      label: "dom 18",
      initial: "d",
      isMonday: false,
    });
  });
});

describe("calibrationZoneOf", () => {
  const counts = (
    overconfident: number,
    underconfident: number,
    calibrated: number,
  ) => ({
    answers: overconfident + underconfident + calibrated,
    overconfident,
    underconfident,
    calibrated,
  });

  it("takes the most frequent per-answer signal", () => {
    expect(calibrationZoneOf(counts(2, 0, 1))).toBe("exceso");
    expect(calibrationZoneOf(counts(0, 3, 1))).toBe("falta");
    expect(calibrationZoneOf(counts(1, 1, 3))).toBe("calibrado");
  });

  it("breaks ties toward the miscalibrated signal, overconfidence first", () => {
    expect(calibrationZoneOf(counts(1, 0, 1))).toBe("exceso");
    expect(calibrationZoneOf(counts(0, 2, 2))).toBe("falta");
    expect(calibrationZoneOf(counts(2, 2, 2))).toBe("exceso");
  });
});

describe("buildDashboardView", () => {
  it("flags a user with no items and no reviews as empty", () => {
    expect(buildDashboardView(emptySources()).isEmpty).toBe(true);
    expect(view().isEmpty).toBe(false);
  });

  it("greets by the hour of the profile zone and the account name", () => {
    expect(view({ hour: 9 }).hero.greeting).toBe("Buenos días, Ana");
    expect(view({ hour: 15 }).hero.greeting).toBe("Buenas tardes, Ana");
    expect(view({ hour: 22 }).hero.greeting).toBe("Buenas noches, Ana");
  });

  it("points the hero at the weakest notebook with items, without a weekly change", () => {
    expect(view().hero.subtitle).toBe(
      "Historia sigue en Aprendiendo: dedícale dos repasos para retomar impulso.",
    );
  });

  it("averages the current mastery of the pages with items for Dominio global", () => {
    const { mastery } = view();
    // Pages with items: 0.8, 0.5, 0.2 → 50%.
    expect(mastery.valuePct).toBe(50);
    expect(mastery.bars.map((bar) => bar.id)).toEqual([
      "p-empty",
      "p-hist",
      "p-cel2",
      "p-cel1",
    ]);
    expect(mastery.bars.map((bar) => bar.level)).toEqual([
      "nuevo",
      "aprendiendo",
      "consolidando",
      "dominado",
    ]);
  });

  it("has no Dominio global value without pages with items", () => {
    expect(buildDashboardView(emptySources()).mastery.valuePct).toBeNull();
  });

  it("maps the daily reviews and compares the total with the previous period", () => {
    const { activity } = view();
    expect(activity.total).toBe(10);
    // 10 vs 8 → +25%.
    expect(activity.deltaPct).toBe(25);
    expect(activity.periodLabel).toBe("la semana anterior");
    expect(activity.days.at(-1)).toMatchObject({
      day: "2026-10-13",
      label: "mar 13",
      flashcards: 3,
      activeRecall: 1,
      exams: 1,
    });
    expect(activity.days.find((day) => day.isMonday)?.weekLabel).toBe("Sem 1");
  });

  it("has no activity delta without reviews in the previous period", () => {
    const metrics = sampleMetrics();
    metrics.overall.previousReviewsCompleted = 0;
    expect(view({ metrics }).activity.deltaPct).toBeNull();
    expect(view({ metrics, range: 15 }).activity.periodLabel).toBe(
      "el período anterior",
    );
  });

  it("pools accuracy across techniques and compares each with the previous period", () => {
    const { accuracy } = view();
    // (6 + 2 + 1) / (8 + 4 + 2) = 9 / 14 → 64%.
    expect(accuracy.overallPct).toBe(64);
    expect(accuracy.techniques).toEqual([
      expect.objectContaining({
        key: "flashcards",
        label: "Flashcards",
        accuracyPct: 75,
        deltaPts: 25,
      }),
      expect.objectContaining({
        key: "activeRecall",
        label: "Active recall",
        accuracyPct: 50,
        deltaPts: null,
      }),
      expect.objectContaining({
        key: "exams",
        label: "Exámenes",
        accuracyPct: 50,
        deltaPts: -50,
      }),
    ]);
  });

  it("has no overall accuracy without outcomes", () => {
    expect(buildDashboardView(emptySources()).accuracy.overallPct).toBeNull();
  });

  it("builds the KPIs: real streak delta, due items and mastered pages without deltas", () => {
    const { kpis } = view();
    expect(kpis.streak).toEqual({ value: "4 días", delta: 2 });
    expect(kpis.due).toEqual({ value: "5", hint: "en 2 páginas" });
    expect(kpis.mastered).toEqual({ value: "1", hint: "de 4 páginas" });
  });

  it("words the KPIs for a single day, a single page and nothing due", () => {
    const metrics = sampleMetrics();
    metrics.overall.streakDays = 1;
    metrics.overall.streakDaysWeekAgo = 1;
    const progress = sampleProgress();
    progress.pages = progress.pages.slice(0, 1);
    for (const page of progress.pages) page.itemsDue = 0;
    const { kpis } = view({ metrics, progress });
    expect(kpis.streak).toEqual({ value: "1 día", delta: 0 });
    expect(kpis.due).toEqual({ value: "0", hint: "Sin repasos pendientes" });
    expect(kpis.mastered.hint).toBe("de 1 página");
  });

  it("lists every notebook with its level and totals, without a trend (no mastery history)", () => {
    expect(view().notebooks).toEqual([
      {
        notebookId: "nb-cel",
        title: "Biología",
        color: "purple",
        itemsTotal: 30,
        itemsDue: 2,
        level: "consolidando",
        avgScorePct: 65,
      },
      {
        notebookId: "nb-hist",
        title: "Historia",
        color: null,
        itemsTotal: 10,
        itemsDue: 3,
        level: "aprendiendo",
        avgScorePct: 20,
      },
    ]);
  });

  it("rounds the calibration averages and takes the zone from the signal counts", () => {
    const rows = view().calibration;
    expect(rows).toEqual([
      {
        id: "p-hist",
        pageTitle: "Renacimiento",
        notebookTitle: "Historia",
        selfAvg: 3.7,
        aiAvg: 2.3,
        gap: 1.4,
        zone: "exceso",
        href: "/active-recall/nb-hist/p-hist",
      },
      expect.objectContaining({ id: "p-cel1", zone: "calibrado", gap: -0.5 }),
    ]);
  });

  it("builds one card per technique from the range's daily reviews", () => {
    const [flashcards, recall, exams] = view().techniques;
    expect(flashcards).toMatchObject({
      key: "flashcards",
      label: "Flashcards",
      reviewsCompleted: 8,
      deltaPct: 100,
      streakDays: 4,
      accuracyPct: 75,
    });
    // At 7 days the dot row covers the 7 days of the range.
    expect(flashcards?.studiedDays).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(flashcards?.recentActivity.map((day) => day.label)).toEqual([
      "x",
      "j",
      "v",
      "s",
      "d",
      "l",
      "m",
    ]);
    expect(flashcards?.recentActivity.at(-1)?.count).toBe(3);
    expect(recall).toMatchObject({ key: "activeRecall", deltaPct: null });
    expect(exams).toMatchObject({ key: "exams", deltaPct: -75 });
  });

  it("caps the dot row at the last 14 days of longer ranges", () => {
    const metrics = sampleMetrics(30);
    const [flashcards] = view({ metrics, range: 30 }).techniques;
    expect(flashcards?.studiedDays).toHaveLength(14);
    expect(flashcards?.recentActivity).toHaveLength(7);
  });

  it("keeps the calibration source order when every page is unique", () => {
    const calibration = sampleCalibration();
    expect(view({ calibration }).calibration.map((row) => row.id)).toEqual(
      calibration.pages.map((page) => page.pageId),
    );
  });
});
