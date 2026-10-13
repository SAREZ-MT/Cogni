// Public API of the "scheduling" module: the "Hoy" view and the "Mes" /
// "Semana" calendar (documento-maestro §3.5). No cross-module import may
// reach past this file (§5.3.5).
export {
  type CalendarDayPageView,
  type DueTodayPageView,
  listCalendarDaysAction,
  listDueTodayAction,
} from "./actions";
export * from "./domain";
export {
  createSchedulingServerApi,
  type SchedulingServerApi,
} from "./server-api";
