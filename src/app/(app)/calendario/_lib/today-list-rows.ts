import {
  addDays,
  type CalendarDayPageView,
  type DayKey,
  type DueKind,
  type DueTodayPageView,
  dayKeyIn,
  type TechniqueOverview,
  weekdayIndex,
} from "@/modules/scheduling";
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from "./day-names";
import {
  pendientes,
  type ReviewRow,
  TECHNIQUES,
  toReviewRows,
} from "./today-rows";

// The calendar's "Hoy" view model (Phase 8 H3-T4). Kept apart from
// today-rows.ts, which Home's client-safe components import: this one uses
// scheduling's runtime day helpers.

// How long a page has waited for review: the "Hoy" row's left column.
export interface WaitingLabel {
  title: string;
  detail: string;
}

// One technique of one page with items due today: a "Hoy" row on the
// calendar, the whole row a link to that technique's session.
export interface TodayRow extends ReviewRow {
  amountLabel: string;
  waiting: WaitingLabel;
}

const DAY_MS = 86_400_000;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// "8 tarjetas" for a deck, "4 preguntas" for recall and exams.
export function amountLabel(kind: DueKind, count: number): string {
  return kind === "flashcard"
    ? plural(count, "tarjeta", "tarjetas")
    : plural(count, "pregunta", "preguntas");
}

// Whole local days between the page's earliest due date and today, both in
// the profile zone: "Desde hoy" (also for an item due later today),
// "Desde ayer", then "Desde el jueves 15".
export function waitingLabel(
  earliestDueAt: Date,
  today: DayKey,
  timeZone: string,
): WaitingLabel {
  const dueDay = dayKeyIn(earliestDueAt, timeZone);
  const days = Math.max(
    0,
    Math.round((Date.parse(today) - Date.parse(dueDay)) / DAY_MS),
  );
  if (days === 0) return { title: "Desde hoy", detail: "Programado hoy" };
  if (days === 1) return { title: "Desde ayer", detail: "1 día esperando" };
  const weekday = WEEKDAYS_LONG[weekdayIndex(dueDay)];
  return {
    title: `Desde el ${weekday} ${Number(dueDay.slice(8, 10))}`,
    detail: `${days} días esperando`,
  };
}

// "Hoy" rows (documento-maestro §3.5, Phase 8 H3-T4): scheduling's due
// pages, already in "waited longest first" order, split into one row per
// technique due — the same study unit as Home's rows. The link's name
// starts with the technique ("Flashcards de …").
export function toTodayRows(
  pages: readonly DueTodayPageView[],
  context: { today: DayKey; timeZone: string },
): TodayRow[] {
  return pages.flatMap((page) => {
    const waiting = waitingLabel(
      page.earliestDueAt,
      context.today,
      context.timeZone,
    );
    return toReviewRows([page]).map((row) => ({
      ...row,
      ariaLabel: `${row.techniqueLabel} de ${row.pageTitle}: ${pendientes(row.count)}`,
      amountLabel: amountLabel(row.kind, row.count),
      waiting,
    }));
  });
}

// The "Hoy" header's count of study units; null when the list failed.
export function todaySummary(units: number | null): string | null {
  if (units === null) return null;
  if (units === 0) return "Sin repasos pendientes";
  return `${plural(units, "repaso", "repasos")} para hoy`;
}

// "X de Y hechos hoy": today's study units done over done + still pending,
// summed over the three techniques. Nothing to show without the overview
// or when today has no unit at all.
export function todayProgress(
  overview: TechniqueOverview | null,
): { done: number; total: number; label: string } | null {
  if (overview === null) return null;
  const totals = Object.values(overview);
  const done = totals.reduce((sum, item) => sum + item.doneUnits, 0);
  const total = totals.reduce(
    (sum, item) => sum + item.doneUnits + item.pendingUnits,
    0,
  );
  if (total === 0) return null;
  return { done, total, label: `${done} de ${total} hechos hoy` };
}

// One review scheduled for a later day on "Hoy" (Phase 8 H3-T4 day
// navigation): not due yet, so the row opens the page, not a session.
export interface ScheduledRow {
  key: string;
  tone: TodayRow["tone"];
  techniqueLabel: string;
  pageTitle: string;
  notebookTitle: string;
  href: string;
  ariaLabel: string;
  amountLabel: string;
}

// A later day's reviews from the calendar read of that single day: one row
// per page and technique, pages in scheduling's order, techniques in the
// panel's order.
export function toScheduledRows(
  pages: readonly CalendarDayPageView[],
): ScheduledRow[] {
  return pages.flatMap((page) =>
    TECHNIQUES.filter(({ kind }) => page.due[kind] > 0).map(
      ({ kind, tone, label }) => {
        const count = page.due[kind];
        return {
          key: `${page.pageId}:${kind}`,
          tone,
          techniqueLabel: label,
          pageTitle: page.pageTitle,
          notebookTitle: page.notebookTitle,
          href: `/notebooks/${page.notebookId}/pages/${page.pageId}`,
          ariaLabel: `${label} de ${page.pageTitle}: ${plural(count, "programado", "programados")}`,
          amountLabel: amountLabel(kind, count),
        };
      },
    ),
  );
}

// A later day's header summary; null when the read failed.
export function scheduledSummary(units: number | null): string | null {
  if (units === null) return null;
  if (units === 0) return "Nada programado";
  return plural(units, "repaso programado", "repasos programados");
}

// The three empty "Hoy" cases (Phase 8 H3, user decision 2026-10-19).
export type EmptyCase = "done" | "clear" | "free-day";

const EMPTY_COPY: Record<EmptyCase, { title: string; description: string }> = {
  // Today, every due review done.
  done: {
    title: "¡Terminaste tus repasos de hoy!",
    description:
      "Tu memoria está al día. Vuelve mañana para mantener el ritmo.",
  },
  // Today, nothing was due.
  clear: {
    title: "Hoy estás al día",
    description:
      "No tienes repasos pendientes. Cogni te avisará cuando toque el próximo.",
  },
  // A later day with nothing scheduled.
  "free-day": {
    title: "Día libre de repasos",
    description: "No hay repasos programados para este día.",
  },
};

export function emptyCopy(kind: EmptyCase): {
  title: string;
  description: string;
} {
  return EMPTY_COPY[kind];
}

// "Próximo repaso: mañana · 2 repasos" linking to that day on Hoy; the
// count is left out when it is unknown.
export function nextReviewLink(input: {
  day: DayKey;
  today: DayKey;
  units: number | null;
}): { href: string; label: string } {
  const { day, today, units } = input;
  const when =
    day === addDays(today, 1)
      ? "mañana"
      : `${WEEKDAYS_SHORT[weekdayIndex(day)]?.toLowerCase() ?? ""} ${Number(day.slice(8, 10))}`;
  const count =
    units === null ? "" : ` · ${plural(units, "repaso", "repasos")}`;
  return {
    href: `/calendario?date=${day}`,
    label: `Próximo repaso: ${when}${count}`,
  };
}
