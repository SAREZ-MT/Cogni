import { getCurrentTimeZoneSetting } from "@/modules/identity";
import { dayKeyIn, getCalendarDays, getDueToday } from "@/modules/scheduling";
import { Card } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { SegmentedTabs } from "@/shared/ui/segmented-tabs";
import { StatusBanner } from "@/shared/ui/status-banner";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { CalendarCardHeader } from "./_components/calendar-card-header";
import { CalendarPeriod } from "./_components/calendar-period";
import { TodayList } from "./_components/today-list";
import {
  type CalendarViewName,
  calendarHref,
  monthRange,
  monthView,
  parseCalendarQuery,
  weekRange,
  weekView,
} from "./_lib/calendar-view";
import { type TodayRow, toTodayRows } from "./_lib/today-rows";

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

function summaryOf(rows: readonly TodayRow[] | null): string | null {
  if (rows === null) return null;
  const total = rows.reduce((sum, row) => sum + row.totalDue, 0);
  if (total === 0) return "Sin repasos pendientes";
  const repasos = total === 1 ? "1 repaso" : `${total} repasos`;
  const paginas = rows.length === 1 ? "1 página" : `${rows.length} páginas`;
  return `${repasos} en ${paginas}`;
}

// Calendar (documento-maestro §3.5, Phase 7) in the Untitled UI month
// calendar style the user chose (2026-10-12): page title + view tabs, then a
// card whose header carries today's date badge, the view title and a short
// summary or range. Events are only system-generated reviews, so there is
// no "add event" action. "Hoy" lists the pages with items due today (the
// whole local day: reviews are due per day); "Mes" and "Semana" show, per
// day in the profile time zone, each page's next due items per technique.
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
  // depends on one read per view, done here before rendering.
  const body =
    view === "hoy"
      ? await todayCard({ now, timeZone })
      : await periodCard({ view, anchor, now, timeZone });

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Calendario" }]} />

      <div className="flex flex-col gap-4">
        <SectionHeader title="Calendario" titleClassName="text-[26px]" />
        <SegmentedTabs
          aria-label="Vistas del calendario"
          items={VIEWS}
          value={view}
        />
      </div>

      <Card
        padding="none"
        className="overflow-hidden"
        data-testid="calendar-card"
      >
        {body}
      </Card>
    </section>
  );
}

async function todayCard({ now, timeZone }: { now: Date; timeZone: string }) {
  // Reviews are due per local day: the whole day of `now` in the zone.
  const result = await getDueToday({ timeZone, now });
  const rows = result.ok ? toTodayRows(result.value) : null;
  const summary = summaryOf(rows);
  return (
    <>
      <CalendarCardHeader
        now={now}
        timeZone={timeZone}
        title="Hoy"
        subtitle={
          <>
            {capitalize(longDayOf(now, timeZone))}
            {summary && (
              <>
                {" · "}
                <span data-testid="today-summary">{summary}</span>
              </>
            )}
          </>
        }
      />
      <TodayList rows={rows} />
    </>
  );
}

async function periodCard({
  view,
  anchor,
  now,
  timeZone,
}: {
  view: Exclude<CalendarViewName, "hoy">;
  anchor: string;
  now: Date;
  timeZone: string;
}) {
  const month = view === "mes";
  const range = month ? monthRange(anchor) : weekRange(anchor);
  const result = await getCalendarDays({ ...range, timeZone, now });
  const input = {
    anchor,
    today: dayKeyIn(now, timeZone),
    days: result.ok ? result.value : [],
  };
  const period = month ? monthView(input) : weekView(input);
  return (
    <>
      <CalendarCardHeader
        now={now}
        timeZone={timeZone}
        title={period.title}
        subtitle={period.rangeLabel}
        nav={period.nav}
        navLabel={month ? "Navegar meses" : "Navegar semanas"}
      />
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
      <CalendarPeriod view={period} variant={month ? "month" : "week"} />
    </>
  );
}
