import { describe, expect, it, vi } from "vitest";

// The scheduling index also exports its Server Actions (server-only
// imports); this suite only uses its pure day helpers.
vi.mock("server-only", () => ({}));

vi.mock("@/modules/notebooks", () => ({
  COLOR_PALETTE: [
    "pink",
    "green",
    "yellow",
    "purple",
    "orange",
    "blue",
    "mint",
  ],
}));

import {
  amountLabel,
  emptyCopy,
  nextReviewLink,
  scheduledSummary,
  todayProgress,
  todaySummary,
  toScheduledRows,
  toTodayRows,
  waitingLabel,
} from "./today-list-rows";

function due(
  pageId: string,
  counts: { flashcard?: number; exam?: number; recall?: number },
  notebookColor: string | null = "green",
) {
  return {
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId: "n1",
    notebookTitle: "Biología",
    notebookColor,
    due: {
      flashcard: counts.flashcard ?? 0,
      exam_question: counts.exam ?? 0,
      recall_question: counts.recall ?? 0,
    },
    earliestDueAt: new Date("2026-10-12T08:00:00.000Z"),
  };
}

describe("toTodayRows", () => {
  const CONTEXT = { today: "2026-10-18", timeZone: "America/Bogota" };

  it("splits each page into one linked row per technique due, keeping the page order", () => {
    const rows = toTodayRows(
      [due("b", { flashcard: 8, exam: 1 }, "pink"), due("a", { recall: 4 })],
      CONTEXT,
    );
    expect(rows.map((row) => row.key)).toEqual([
      "b:flashcard",
      "b:exam_question",
      "a:recall_question",
    ]);
    expect(rows[0]).toMatchObject({
      kind: "flashcard",
      tone: "yellow",
      techniqueLabel: "Flashcards",
      count: 8,
      pageTitle: "Página b",
      notebookTitle: "Biología",
      href: "/flashcards/n1/b?repasar=1",
      ariaLabel: "Flashcards de Página b: 8 pendientes",
      amountLabel: "8 tarjetas",
    });
    expect(rows[1]).toMatchObject({
      ariaLabel: "Examen de Página b: 1 pendiente",
      amountLabel: "1 pregunta",
    });
    expect(rows[2]).toMatchObject({
      ariaLabel: "Recordación activa de Página a: 4 pendientes",
      amountLabel: "4 preguntas",
    });
  });

  it("tells how long each page has waited, from its earliest due date in the zone", () => {
    // 2026-10-12T08:00Z is 03:00 on Monday 12 Oct in Bogotá.
    const [row] = toTodayRows([due("p", { flashcard: 1 })], CONTEXT);
    expect(row?.waiting).toEqual({
      title: "Desde el lunes 12",
      detail: "6 días esperando",
    });
  });
});

describe("waitingLabel", () => {
  const zone = "America/Bogota";
  it.each([
    ["2026-10-18T15:00:00.000Z", "Desde hoy", "Programado hoy"],
    // Later today still reads "today".
    ["2026-10-19T03:00:00.000Z", "Desde hoy", "Programado hoy"],
    ["2026-10-17T20:00:00.000Z", "Desde ayer", "1 día esperando"],
    ["2026-10-15T12:00:00.000Z", "Desde el jueves 15", "3 días esperando"],
  ])("labels an item due at %s", (dueAt, title, detail) => {
    expect(waitingLabel(new Date(dueAt), "2026-10-18", zone)).toEqual({
      title,
      detail,
    });
  });
});

describe("amountLabel", () => {
  it.each([
    ["flashcard", 1, "1 tarjeta"],
    ["flashcard", 8, "8 tarjetas"],
    ["recall_question", 1, "1 pregunta"],
    ["exam_question", 10, "10 preguntas"],
  ] as const)("labels %s × %i as %s", (kind, count, label) => {
    expect(amountLabel(kind, count)).toBe(label);
  });
});

describe("todaySummary", () => {
  it("counts study units for today", () => {
    expect(todaySummary(null)).toBeNull();
    expect(todaySummary(0)).toBe("Sin repasos pendientes");
    expect(todaySummary(1)).toBe("1 repaso para hoy");
    expect(todaySummary(3)).toBe("3 repasos para hoy");
  });
});

describe("todayProgress", () => {
  const totals = (doneUnits: number, pendingUnits: number) => ({
    total: 0,
    nextDueAt: null,
    doneUnits,
    pendingUnits,
  });

  it("sums done and pending units over the three techniques", () => {
    expect(
      todayProgress({
        flashcard: totals(1, 2),
        recall_question: totals(0, 1),
        exam_question: totals(1, 0),
      }),
    ).toEqual({ done: 2, total: 5, label: "2 de 5 hechos hoy" });
  });

  it("has nothing to show without the overview or with no unit today", () => {
    expect(todayProgress(null)).toBeNull();
    expect(
      todayProgress({
        flashcard: totals(0, 0),
        recall_question: totals(0, 0),
        exam_question: totals(0, 0),
      }),
    ).toBeNull();
  });
});

describe("toScheduledRows", () => {
  const page = (
    pageId: string,
    due: { flashcard?: number; exam?: number; recall?: number },
  ) => ({
    day: "2026-10-20",
    pageId,
    pageTitle: `Página ${pageId}`,
    notebookId: "n1",
    notebookTitle: "Biología",
    due: {
      flashcard: due.flashcard ?? 0,
      exam_question: due.exam ?? 0,
      recall_question: due.recall ?? 0,
    },
  });

  it("lists a later day's reviews as one row per page and technique, opening the page", () => {
    const rows = toScheduledRows([page("a", { flashcard: 8, exam: 1 })]);
    expect(rows).toEqual([
      {
        key: "a:flashcard",
        tone: "yellow",
        techniqueLabel: "Flashcards",
        pageTitle: "Página a",
        notebookTitle: "Biología",
        href: "/notebooks/n1/pages/a",
        ariaLabel: "Flashcards de Página a: 8 programados",
        amountLabel: "8 tarjetas",
      },
      {
        key: "a:exam_question",
        tone: "rose",
        techniqueLabel: "Examen",
        pageTitle: "Página a",
        notebookTitle: "Biología",
        href: "/notebooks/n1/pages/a",
        ariaLabel: "Examen de Página a: 1 programado",
        amountLabel: "1 pregunta",
      },
    ]);
  });

  it("summarises the day's scheduled units", () => {
    expect(scheduledSummary(null)).toBeNull();
    expect(scheduledSummary(0)).toBe("Nada programado");
    expect(scheduledSummary(1)).toBe("1 repaso programado");
    expect(scheduledSummary(3)).toBe("3 repasos programados");
  });
});

describe("emptyCopy", () => {
  it("words each empty case", () => {
    expect(emptyCopy("done")).toEqual({
      title: "¡Terminaste tus repasos de hoy!",
      description:
        "Tu memoria está al día. Vuelve mañana para mantener el ritmo.",
    });
    expect(emptyCopy("clear")).toEqual({
      title: "Hoy estás al día",
      description:
        "No tienes repasos pendientes. Cogni te avisará cuando toque el próximo.",
    });
    expect(emptyCopy("free-day")).toEqual({
      title: "Día libre de repasos",
      description: "No hay repasos programados para este día.",
    });
  });
});

describe("nextReviewLink", () => {
  it("links to the next review day with its units", () => {
    expect(
      nextReviewLink({ day: "2026-10-19", today: "2026-10-18", units: 2 }),
    ).toEqual({
      href: "/calendario?date=2026-10-19",
      label: "Próximo repaso: mañana · 2 repasos",
    });
    expect(
      nextReviewLink({ day: "2026-10-21", today: "2026-10-18", units: 1 }),
    ).toEqual({
      href: "/calendario?date=2026-10-21",
      label: "Próximo repaso: mié 21 · 1 repaso",
    });
  });

  it("leaves the count out when it is unknown", () => {
    expect(
      nextReviewLink({ day: "2026-10-19", today: "2026-10-18", units: null })
        .label,
    ).toBe("Próximo repaso: mañana");
  });
});
