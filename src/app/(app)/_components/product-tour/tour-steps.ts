// Product tour content (docs/new_design_fase_8/inicio-tour-y-empty-state.md
// §1.4). Plain data so it can be tested without Driver.js; product-tour.tsx
// is the thin adapter that turns it into Driver.js steps.

export type TourStepId =
  | "welcome"
  | "cuadernos"
  | "tecnicas"
  | "avance"
  | "crear-cuaderno";

export interface TourStep {
  id: TourStepId;
  // CSS selector of the highlighted element; undefined = centered modal.
  anchor?: string;
  title: string;
  description: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    title: "Te damos la bienvenida a Cogni",
    description:
      "Convierte tus apuntes en flashcards, recordación activa y exámenes. Te mostramos lo esencial en menos de un minuto.",
  },
  {
    id: "cuadernos",
    anchor: '[data-tour="cuadernos"]',
    title: "Tus cuadernos",
    description:
      "Crea un cuaderno por materia. Dentro crea páginas para tus notas e importa tus PDFs.",
  },
  {
    id: "tecnicas",
    anchor: '[data-tour="tecnicas"]',
    title: "Tus notas, convertidas en práctica",
    description:
      "Desde cada página generas técnicas de estudio con IA. Aquí encuentras todo lo que crees, listo para practicar.",
  },
  {
    id: "avance",
    // Progreso and Calendario, highlighted together (user 2026-10-18).
    anchor: '[data-tour="avance"]',
    title: "Tus repasos y tu avance",
    description:
      "Cogni agenda cada repaso justo antes de que lo olvides. Míralo en Calendario y tu avance en Progreso.",
  },
  {
    id: "crear-cuaderno",
    anchor: '[data-tour="crear-cuaderno"]',
    title: "Empieza aquí",
    description:
      "Crea tu primer cuaderno y agrega una página para generar tus primeras técnicas.",
  },
];

// The steps whose anchor is on screen right now. Filtering up front (instead
// of only relying on Driver.js's skipMissingElement) keeps "Paso X de N" and
// the last-step buttons right: an owner who already has notebooks replays
// the tour from settings without the create step, so step 4 is the last.
export function tourStepsFor(
  isPresent: (selector: string) => boolean,
): TourStep[] {
  return TOUR_STEPS.filter((step) => !step.anchor || isPresent(step.anchor));
}
