import * as Sentry from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { getDashboardTechniqueMetrics } from "@/modules/analytics";
import { getCurrentTimeZoneSetting } from "@/modules/identity";
import {
  addDays,
  dayKeyIn,
  getCalendarDays,
  getDueToday,
  getTechniqueOverview,
  type TechniqueOverview,
} from "@/modules/scheduling";
import { Card } from "@/shared/ui/card";
import { DateBadge } from "@/shared/ui/date-badge";
import { SectionHeader } from "@/shared/ui/section-header";
import { SegmentedTabs } from "@/shared/ui/segmented-tabs";
import { StatusBanner } from "@/shared/ui/status-banner";
import { cn } from "@/shared/ui/utils";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { CalendarPeriod } from "./_components/calendar-period";
import { MonthDayPanel } from "./_components/month-day-panel";
import { PeriodHeader } from "./_components/period-header";
import { ScheduledList } from "./_components/scheduled-list";
import { TodayList } from "./_components/today-list";
import { WeekSummary } from "./_components/week-summary";
import {
  type CalendarNavView,
  type CalendarViewName,
  calendarHref,
  dayView,
  monthDayPanel,
  monthRange,
  monthView,
  nextSevenDays,
  parseCalendarQuery,
  weekRange,
  weekTechniqueProgress,
  weekView,
} from "./_lib/calendar-view";
import {
  nextReviewLink,
  scheduledSummary,
  todayProgress,
  todaySummary,
  toScheduledRows,
  toTodayRows,
} from "./_lib/today-list-rows";

// The view lives in the URL (`?view=semana|mes`, `?date=YYYY-MM-DD`), like
// the notebooks' `?view=` toggle, so it survives reloads and needs no JS.
const VIEWS = [
  { value: "hoy", label: "Hoy", href: calendarHref("hoy") },
  { value: "semana", label: "Semana", href: calendarHref("semana") },
  { value: "mes", label: "Mes", href: calendarHref("mes") },
] as const;

interface CalendarPageProps {
  searchParams: Promise<{ view?: string | string[]; date?: string | string[] }>;
}

// "Lunes, 12 de octubre" in the profile time zone (Phase 7 T2a). The due
// query itself (`due_at <= now`) does not depend on the zone.
function longDayOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(date);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Optional reads (the done pill, the week's progress chart): a typed
// failure or a thrown rejection degrades only their block, never the
// page. Next.js control-flow errors are rethrown to the framework first.
async function readOptional<T>(
  read: () => Promise<{ ok: true; value: T } | { ok: false }>,
): Promise<T | null> {
  try {
    const result = await read();
    return result.ok ? result.value : null;
  } catch (error) {
    unstable_rethrow(error);
    Sentry.captureException(error);
    return null;
  }
}

// What a view renders: its period block for the page header, the card body
// and, for Semana, the metric card.
interface ViewContent {
  // The day the date badge shows (a local day key).
  badgeDay: string;
  period: {
    overline?: string;
    title: string;
    subtitle?: ReactNode;
    nav: CalendarNavView;
    navLabel: string;
  };
  body: ReactNode;
  metrics: ReactNode;
}

// Calendar (documento-maestro §3.5, Phase 7; Phase 8 H3 header): page title
// and view tabs, then the shown period — today's date badge, the period
// title and its navigation — in the same header row, and a card with the
// period itself. Events are only system-generated reviews, so there is no
// "add event" action. "Hoy" lists the pages with items due today (the whole
// local day: reviews are due per day) or, on a later day, the reviews
// scheduled for it; "Mes" and "Semana" show, per day in the profile time
// zone, each page's next due items per technique.
export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const [params, setting] = await Promise.all([
    searchParams,
    getCurrentTimeZoneSetting(),
  ]);
  const { timeZone } = setting;
  // One instant for the whole render: the today cell, the date badge and
  // the read that folds overdue items into today all agree on the day.
  const now = new Date();
  const { view, anchor } = parseCalendarQuery(params, dayKeyIn(now, timeZone));
  // Plain awaited helpers rather than async child components: the card body
  // (and Semana's metric card) depend on one read per view, done here
  // before rendering.
  const { badgeDay, period, body, metrics } =
    view === "hoy"
      ? await dayContent({ anchor, now, timeZone })
      : await periodContent({ view, anchor, now, timeZone });

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Calendario" }]} />

      {/* One header for every view (Phase 8 H3, user reviews 2026-10-19):
          the date badge, as tall as the title + tabs stack, then the title
          over the tabs row, where the period line (title, suffix, bare
          arrows) sits beside the tabs, centred on them. The badge, title,
          tabs and period sit at the same place in Hoy, Semana and Mes.
          Semana's metric card fills a right-hand slot capped at the
          header's height (lg: absolutely positioned inside a stretched flex
          item). Below lg the period and the card wrap under the tabs. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="flex min-w-0 items-stretch gap-4">
          <DateBadge
            // The badge shows a day key: noon UTC read in UTC is that day.
            date={new Date(`${badgeDay}T12:00:00.000Z`)}
            timeZone="UTC"
            tone="brand"
            size="xl"
            // As tall as the title + tabs stack; below lg (where the period
            // wraps under the tabs) it keeps that height, and on phones it
            // hides: the period line already says the date.
            className="hidden h-[97px] self-start sm:inline-flex lg:h-full lg:self-stretch"
          />
          <div className="flex min-w-0 flex-col gap-4">
            <SectionHeader
              title="Calendario"
              titleClassName="text-[26px] text-gradient-brand"
            />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-5">
              <SegmentedTabs
                aria-label="Vistas del calendario"
                items={VIEWS}
                value={view}
              />
              <PeriodHeader {...period} />
            </div>
          </div>
        </div>
        {metrics && (
          <div className="min-w-0 lg:relative lg:ml-auto lg:max-w-[26rem] lg:flex-1">
            <div className="lg:absolute lg:inset-0">{metrics}</div>
          </div>
        )}
      </div>

      {/* Semana's card fills the rest of the page so its day columns reach
          the bottom (Phase 8 H3). */}
      <Card
        padding="none"
        className={cn(
          "flex flex-col overflow-hidden",
          view === "semana" && "flex-1",
        )}
        data-testid="calendar-card"
      >
        {body}
      </Card>
    </section>
  );
}

async function dayContent({
  anchor,
  now,
  timeZone,
}: {
  anchor: string;
  now: Date;
  timeZone: string;
}): Promise<ViewContent> {
  const today = dayKeyIn(now, timeZone);
  const day = dayView({ anchor, today });
  const header = { title: day.title, nav: day.nav, navLabel: "Navegar días" };
  const badgeDay = day.badgeDay;
  if (!day.isToday) {
    // A later day: the reviews scheduled for it, from the calendar read of
    // that single local day. Nothing is due yet, so no done pill.
    const result = await getCalendarDays({
      fromDay: anchor,
      toDay: addDays(anchor, 1),
      timeZone,
      now,
    });
    const rows = result.ok ? toScheduledRows(result.value) : null;
    const summary = scheduledSummary(rows ? rows.length : null);
    return {
      badgeDay,
      period: {
        ...header,
        subtitle: summary && <span data-testid="today-summary">{summary}</span>,
      },
      body: (
        <ScheduledList rows={rows} weekHref={calendarHref("semana", anchor)} />
      ),
      metrics: null,
    };
  }
  // Reviews are due per local day: the whole day of `now` in the zone.
  const [result, overview] = await Promise.all([
    getDueToday({ timeZone, now }),
    readOptional<TechniqueOverview>(() =>
      getTechniqueOverview({ timeZone, now }),
    ),
  ]);
  const rows = result.ok
    ? toTodayRows(result.value, { today, timeZone })
    : null;
  const summary = todaySummary(rows ? rows.length : null);
  const progress = todayProgress(overview);
  const empty = {
    kind:
      progress && progress.done > 0 ? ("done" as const) : ("clear" as const),
    next:
      rows?.length === 0
        ? await nextReview({ overview, today, now, timeZone })
        : null,
  };
  return {
    badgeDay,
    period: {
      ...header,
      subtitle: (
        <>
          {capitalize(longDayOf(now, timeZone))}
          {summary && (
            <>
              {" · "}
              <span data-testid="today-summary">{summary}</span>
            </>
          )}
        </>
      ),
    },
    body: <TodayList rows={rows} progress={progress} empty={empty} />,
    metrics: null,
  };
}

// The empty Hoy's "Próximo repaso" link: the earliest next due date of the
// technique overview (from tomorrow on), in the profile zone, with that
// day's study units from a one-day calendar read (left out if it fails).
// Null when nothing is scheduled.
async function nextReview({
  overview,
  today,
  now,
  timeZone,
}: {
  overview: TechniqueOverview | null;
  today: string;
  now: Date;
  timeZone: string;
}): Promise<{ href: string; label: string } | null> {
  const dates = overview
    ? Object.values(overview)
        .map((totals) => totals.nextDueAt)
        .filter((date): date is Date => date !== null)
    : [];
  if (dates.length === 0) return null;
  const earliest = new Date(Math.min(...dates.map((date) => date.getTime())));
  const day = dayKeyIn(earliest, timeZone);
  const days = await readOptional(() =>
    getCalendarDays({ fromDay: day, toDay: addDays(day, 1), timeZone, now }),
  );
  return nextReviewLink({
    day,
    today,
    units: days ? toScheduledRows(days).length : null,
  });
}

async function periodContent({
  view,
  anchor,
  now,
  timeZone,
}: {
  view: Exclude<CalendarViewName, "hoy">;
  anchor: string;
  now: Date;
  timeZone: string;
}): Promise<ViewContent> {
  const month = view === "mes";
  const range = month ? monthRange(anchor) : weekRange(anchor);
  const today = dayKeyIn(now, timeZone);
  const [result, daily, nextDays] = await Promise.all([
    getCalendarDays({ ...range, timeZone, now }),
    // "Progreso de la semana": completed reviews per day of the shown week.
    month
      ? null
      : readOptional(() =>
          getDashboardTechniqueMetrics({ ...range, timeZone, now }),
        ).then((metrics) => metrics?.daily ?? null),
    // Mes: the seven days after the selected day (the anchor), which may
    // cross into the next month; an empty list if the read fails.
    month
      ? readOptional(() =>
          getCalendarDays({ ...nextSevenDays(anchor), timeZone, now }),
        )
      : null,
  ]);
  const input = { anchor, today, days: result.ok ? result.value : [] };
  const monthPeriod = month ? monthView(input) : null;
  const period = monthPeriod ?? weekView(input);
  return {
    badgeDay: period.badgeDay,
    period: {
      overline: period.overline,
      title: period.title,
      nav: period.nav,
      navLabel: month ? "Navegar meses" : "Navegar semanas",
    },
    body: (
      <>
        {!result.ok && (
          <div className="border-border-subtle border-b px-4 py-3 md:px-6">
            <StatusBanner
              role="alert"
              tone="error"
              title="No pudimos cargar tus repasos"
              description="El calendario se muestra vacío. Intenta de nuevo en un momento."
            />
          </div>
        )}
        <CalendarPeriod
          view={period}
          variant={month ? "month" : "week"}
          aside={
            monthPeriod ? (
              <MonthDayPanel
                panel={monthDayPanel({
                  selected: monthPeriod.selected,
                  days: input.days,
                  window: nextDays ?? [],
                })}
              />
            ) : undefined
          }
        />
      </>
    ),
    metrics: month ? null : (
      <WeekSummary
        progress={weekTechniqueProgress({
          days: result.ok ? result.value : [],
          daily,
        })}
      />
    ),
  };
}
