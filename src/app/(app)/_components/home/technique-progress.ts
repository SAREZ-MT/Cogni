import { addDays, dayKeyIn } from "@/modules/scheduling";

// Today's progress of one technique on a Home card (Phase 8 H2-T5f), so the
// cards no longer repeat the "Para repasar hoy" list: study units done
// today against today's workload (done + still due), or why there is
// nothing to do today. A unit is one page × technique (H2-T5i, user
// decision 2026-10-18): five exams due read "0 de 5", not "0 de 100".
export interface TechniqueProgressInput {
  label: string;
  // Pages reviewed today with nothing of the technique left due; null when
  // the read failed.
  doneUnits: number | null;
  // Pages with an item of the technique due today (the whole local day);
  // null when the read failed.
  pendingUnits: number | null;
  // All live items of the technique (due or not); null when the read failed.
  itemTotal: number | null;
  // Next due date from tomorrow on, or null when nothing is scheduled.
  nextDueAt: Date | null;
  timeZone: string;
  now: Date;
}

export type TechniqueProgressState =
  | "progress"
  | "done"
  | "none"
  | "never"
  | "unknown";

export interface TechniqueProgress {
  state: TechniqueProgressState;
  // The big value: the done count, "Al día", or a short phrase.
  value: string;
  // " de {total}" next to the done count; null otherwise.
  valueSuffix: string | null;
  // "tone" uses the technique colour; "muted" reads quiet.
  emphasis: "tone" | "muted";
  sub: string;
  ring: { percent: number; center: "percent" | "check" | "dash" };
  // Full accessible name of the card link.
  ariaLabel: string;
}

const NO_RING = { percent: 0, center: "dash" } as const;

const DAY_MS = 86_400_000;

// Whole local days between two ISO day keys ("2026-10-18").
function daysBetween(fromDay: string, toDay: string): number {
  return Math.round(
    (Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) /
      DAY_MS,
  );
}

// "mañana" when the next review falls tomorrow in the user's zone; "el
// lunes 20" (weekday and day of month, lowercase) up to six days ahead in
// the same month; "el lunes 3 de noviembre" seven or more days ahead or in
// another month.
function nextReviewLabel(next: Date, timeZone: string, now: Date): string {
  const today = dayKeyIn(now, timeZone);
  const nextDay = dayKeyIn(next, timeZone);
  if (nextDay === addDays(today, 1)) return "mañana";
  const weekday = new Intl.DateTimeFormat("es", { timeZone, weekday: "long" })
    .format(next)
    .toLocaleLowerCase("es");
  const label = `el ${weekday} ${Number(nextDay.slice(8))}`;
  const sameMonth = nextDay.slice(0, 7) === today.slice(0, 7);
  if (sameMonth && daysBetween(today, nextDay) < 7) return label;
  const month = new Intl.DateTimeFormat("es", { timeZone, month: "long" })
    .format(next)
    .toLocaleLowerCase("es");
  return `${label} de ${month}`;
}

export function techniqueProgress(
  input: TechniqueProgressInput,
): TechniqueProgress {
  const { label } = input;
  const unknown: TechniqueProgress = {
    state: "unknown",
    value: "—",
    valueSuffix: null,
    emphasis: "muted",
    sub: "No pudimos cargar tu progreso",
    ring: NO_RING,
    ariaLabel: `${label}: progreso no disponible`,
  };
  if (input.doneUnits === null || input.pendingUnits === null) return unknown;

  const pending = Math.max(0, input.pendingUnits);
  const total = Math.max(0, input.doneUnits) + pending;
  // Defensive: done never goes past the day's workload, nor below zero.
  const done = Math.min(Math.max(0, input.doneUnits), total);

  if (pending > 0) {
    return {
      state: "progress",
      value: String(done),
      valueSuffix: `de ${total}`,
      emphasis: "tone",
      sub: "repasos hechos hoy",
      // Floor: an unfinished day never reads 100%.
      ring: { percent: Math.floor((done / total) * 100), center: "percent" },
      ariaLabel: `${label}: ${done} de ${total} repasos hechos hoy`,
    };
  }
  if (done > 0) {
    return {
      state: "done",
      value: "Al día",
      valueSuffix: null,
      emphasis: "tone",
      sub: `${done} de ${done} repasos hechos hoy`,
      ring: { percent: 100, center: "check" },
      ariaLabel: `${label}: al día, ${done} ${done === 1 ? "repaso hecho" : "repasos hechos"} hoy`,
    };
  }
  if (input.itemTotal === null) return unknown;
  if (input.itemTotal <= 0) {
    return {
      state: "never",
      value: "Aún no generas",
      valueSuffix: null,
      emphasis: "muted",
      sub: "Genera desde una página",
      ring: NO_RING,
      ariaLabel: `${label}: aún no generas contenido`,
    };
  }
  const next = input.nextDueAt
    ? nextReviewLabel(input.nextDueAt, input.timeZone, input.now)
    : null;
  return {
    state: "none",
    value: "Sin repasos hoy",
    valueSuffix: null,
    emphasis: "muted",
    sub: next ? `Próximo repaso: ${next}` : "Nada agendado",
    ring: NO_RING,
    ariaLabel: next
      ? `${label}: sin repasos hoy, próximo repaso ${next}`
      : `${label}: sin repasos hoy, nada agendado`,
  };
}
