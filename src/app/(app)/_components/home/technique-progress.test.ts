import { describe, expect, it, vi } from "vitest";

// The scheduling barrel also exports server reads (server-only); the
// helper only needs its pure day arithmetic.
vi.mock("@/modules/scheduling", async () => ({
  ...(await import("@/modules/scheduling/domain")),
}));

import {
  type TechniqueProgressInput,
  techniqueProgress,
} from "./technique-progress";

// Sunday 18 Oct 2026, 10:00 in Bogotá (-05).
const NOW = new Date("2026-10-18T15:00:00.000Z");

function input(
  overrides: Partial<TechniqueProgressInput> = {},
): TechniqueProgressInput {
  return {
    label: "Flashcards",
    doneUnits: 0,
    pendingUnits: 0,
    itemTotal: 0,
    nextDueAt: null,
    timeZone: "America/Bogota",
    now: NOW,
    ...overrides,
  };
}

describe("techniqueProgress", () => {
  it("shows today's progress while reviews are pending", () => {
    expect(
      techniqueProgress(
        input({ doneUnits: 3, pendingUnits: 5, itemTotal: 20 }),
      ),
    ).toEqual({
      state: "progress",
      value: "3",
      valueSuffix: "de 8",
      emphasis: "tone",
      sub: "repasos hechos hoy",
      ring: { percent: 37, center: "percent" },
      ariaLabel: "Flashcards: 3 de 8 repasos hechos hoy",
    });
  });

  it("starts the progress at zero before the first review", () => {
    const view = techniqueProgress(
      input({ doneUnits: 0, pendingUnits: 4, itemTotal: 4 }),
    );
    expect(view.state).toBe("progress");
    expect(view.value).toBe("0");
    expect(view.ring).toEqual({ percent: 0, center: "percent" });
    expect(view.ariaLabel).toBe("Flashcards: 0 de 4 repasos hechos hoy");
  });

  it("never rounds an unfinished day up to 100%", () => {
    const view = techniqueProgress(
      input({ doneUnits: 199, pendingUnits: 1, itemTotal: 200 }),
    );
    expect(view.ring.percent).toBe(99);
  });

  it("clamps impossible counts so done stays within 0..total", () => {
    const view = techniqueProgress(
      input({ doneUnits: -2, pendingUnits: 3, itemTotal: 3 }),
    );
    expect(view.value).toBe("0");
    expect(view.valueSuffix).toBe("de 3");
    expect(view.ring.percent).toBe(0);
  });

  it("is up to date when today's reviews are all done", () => {
    expect(
      techniqueProgress(
        input({ doneUnits: 6, pendingUnits: 0, itemTotal: 30 }),
      ),
    ).toEqual({
      state: "done",
      value: "Al día",
      valueSuffix: null,
      emphasis: "tone",
      sub: "6 de 6 repasos hechos hoy",
      ring: { percent: 100, center: "check" },
      ariaLabel: "Flashcards: al día, 6 repasos hechos hoy",
    });
  });

  it("uses the singular for a single review done", () => {
    expect(
      techniqueProgress(input({ doneUnits: 1, pendingUnits: 0, itemTotal: 2 }))
        .ariaLabel,
    ).toBe("Flashcards: al día, 1 repaso hecho hoy");
  });

  it("says when the next review is tomorrow", () => {
    expect(
      techniqueProgress(
        input({
          itemTotal: 5,
          // Monday 19 Oct, 07:00 in Bogotá.
          nextDueAt: new Date("2026-10-19T12:00:00.000Z"),
        }),
      ),
    ).toEqual({
      state: "none",
      value: "Sin repasos hoy",
      valueSuffix: null,
      emphasis: "muted",
      sub: "Próximo repaso: mañana",
      ring: { percent: 0, center: "dash" },
      ariaLabel: "Flashcards: sin repasos hoy, próximo repaso mañana",
    });
  });

  it("names the weekday and date of a later next review", () => {
    const view = techniqueProgress(
      input({
        itemTotal: 5,
        // Wednesday 21 Oct in Bogotá.
        nextDueAt: new Date("2026-10-21T16:00:00.000Z"),
      }),
    );
    expect(view.sub).toBe("Próximo repaso: el miércoles 21");
    expect(view.ariaLabel).toBe(
      "Flashcards: sin repasos hoy, próximo repaso el miércoles 21",
    );
  });

  it("reads the next review's day in the user's zone", () => {
    // Tuesday 20 Oct 03:00 UTC is still Monday 19 Oct 22:00 in Bogotá.
    const nextDueAt = new Date("2026-10-20T03:00:00.000Z");

    expect(techniqueProgress(input({ itemTotal: 1, nextDueAt })).sub).toBe(
      "Próximo repaso: mañana",
    );
    expect(
      techniqueProgress(input({ itemTotal: 1, nextDueAt, timeZone: "UTC" }))
        .sub,
    ).toBe("Próximo repaso: el martes 20");
  });

  it("says nothing is scheduled when no review lies ahead", () => {
    const view = techniqueProgress(input({ itemTotal: 3, nextDueAt: null }));
    expect(view.state).toBe("none");
    expect(view.sub).toBe("Nada agendado");
    expect(view.ariaLabel).toBe("Flashcards: sin repasos hoy, nada agendado");
  });

  it("invites to generate when the technique has no items yet", () => {
    expect(techniqueProgress(input({ itemTotal: 0 }))).toEqual({
      state: "never",
      value: "Aún no generas",
      valueSuffix: null,
      emphasis: "muted",
      sub: "Genera desde una página",
      ring: { percent: 0, center: "dash" },
      ariaLabel: "Flashcards: aún no generas contenido",
    });
  });

  it.each([
    { doneUnits: null },
    { pendingUnits: null },
    { itemTotal: null },
  ])("is unknown when a read failed (%o)", (failed) => {
    expect(techniqueProgress(input({ itemTotal: 2, ...failed }))).toEqual({
      state: "unknown",
      value: "—",
      valueSuffix: null,
      emphasis: "muted",
      sub: "No pudimos cargar tu progreso",
      ring: { percent: 0, center: "dash" },
      ariaLabel: "Flashcards: progreso no disponible",
    });
  });

  it("still shows progress when only the item totals failed to load", () => {
    const view = techniqueProgress(
      input({ doneUnits: 1, pendingUnits: 2, itemTotal: null }),
    );
    expect(view.state).toBe("progress");
    expect(view.ariaLabel).toBe("Flashcards: 1 de 3 repasos hechos hoy");
  });
});
