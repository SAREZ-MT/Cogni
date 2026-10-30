import { describe, expect, it } from "vitest";
import { TOUR_STEPS, tourStepsFor } from "./tour-steps";

describe("TOUR_STEPS", () => {
  it("defines the five steps in order with their Spanish titles", () => {
    expect(TOUR_STEPS.map((step) => step.title)).toEqual([
      "Te damos la bienvenida a Cogni",
      "Tus cuadernos",
      "Tus notas, convertidas en práctica",
      "Tus repasos y tu avance",
      "Empieza aquí",
    ]);
  });

  it("anchors steps 2 to 5 on stable data-tour attributes and centers step 1", () => {
    expect(TOUR_STEPS.map((step) => step.anchor)).toEqual([
      undefined,
      '[data-tour="cuadernos"]',
      '[data-tour="tecnicas"]',
      '[data-tour="avance"]',
      '[data-tour="crear-cuaderno"]',
    ]);
  });

  // User copy 2026-10-17.
  it("explains notebooks, pages and PDF import in step 2", () => {
    expect(TOUR_STEPS[1]?.description).toBe(
      "Crea un cuaderno por materia. Dentro crea páginas para tus notas e importa tus PDFs.",
    );
  });

  // User copy 2026-10-18.
  it("explains in step 3 that techniques are generated from each page", () => {
    expect(TOUR_STEPS[2]?.description).toBe(
      "Desde cada página generas técnicas de estudio con IA. Aquí encuentras todo lo que crees, listo para practicar.",
    );
  });

  it("explains in step 4 both the review schedule and the Progreso section", () => {
    expect(TOUR_STEPS[3]?.description).toBe(
      "Cogni agenda cada repaso justo antes de que lo olvides. Míralo en Calendario y tu avance en Progreso.",
    );
  });

  it("keeps every description within the two-line budget", () => {
    for (const step of TOUR_STEPS) {
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.description.length).toBeLessThanOrEqual(120);
    }
  });
});

describe("tourStepsFor", () => {
  it("keeps all five steps when every anchor is present", () => {
    expect(tourStepsFor(() => true).map((step) => step.id)).toEqual([
      "welcome",
      "cuadernos",
      "tecnicas",
      "avance",
      "crear-cuaderno",
    ]);
  });

  it("drops the create step when its anchor is missing, so step 4 is the last", () => {
    const steps = tourStepsFor(
      (selector) => selector !== '[data-tour="crear-cuaderno"]',
    );

    expect(steps.map((step) => step.id)).toEqual([
      "welcome",
      "cuadernos",
      "tecnicas",
      "avance",
    ]);
  });

  it("keeps the centered welcome step even when nothing else is on screen", () => {
    expect(tourStepsFor(() => false).map((step) => step.id)).toEqual([
      "welcome",
    ]);
  });
});
