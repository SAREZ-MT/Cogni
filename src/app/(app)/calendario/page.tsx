import { getCurrentTimeZoneSetting } from "@/modules/identity";
import { listDueTodayAction } from "@/modules/scheduling";
import { Card } from "@/shared/ui/card";
import { DateBadge } from "@/shared/ui/date-badge";
import { SectionHeader } from "@/shared/ui/section-header";
import { SegmentedTabs } from "@/shared/ui/segmented-tabs";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { TodayList } from "./_components/today-list";
import { type TodayRow, toTodayRows } from "./_lib/today-rows";

// Semana and Mes arrive in Phase 7 T2; until then they are disabled tabs so
// the header already has its final shape and T2 only adds their hrefs.
const VIEWS = [
  { value: "hoy", label: "Hoy", href: "/calendario" },
  { value: "semana", label: "Semana", disabled: true, hint: "Próximamente" },
  { value: "mes", label: "Mes", disabled: true, hint: "Próximamente" },
] as const;

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
// summary. Events are only system-generated reviews, so there is no "add
// event" action. "Hoy" lists the pages with items due now (scheduling's
// listDueToday), each technique opening its session.
export default async function CalendarPage() {
  const [result, { timeZone }] = await Promise.all([
    listDueTodayAction(),
    getCurrentTimeZoneSetting(),
  ]);
  const rows = result.ok ? toTodayRows(result.value) : null;
  const now = new Date();
  const summary = summaryOf(rows);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Calendario" }]} />

      <div className="flex flex-col gap-4">
        <SectionHeader title="Calendario" titleClassName="text-[26px]" />
        <SegmentedTabs
          aria-label="Vistas del calendario"
          items={VIEWS}
          value="hoy"
        />
      </div>

      <Card padding="none" data-testid="calendar-card">
        <div className="flex items-center gap-4 border-border-subtle border-b px-6 py-5">
          <DateBadge date={now} timeZone={timeZone} />
          <div className="min-w-0">
            <h2 className="font-semibold text-fg text-lg leading-tight">Hoy</h2>
            <p className="mt-0.5 text-fg-muted text-sm">
              {capitalize(longDayOf(now, timeZone))}
              {summary && (
                <>
                  {" · "}
                  <span data-testid="today-summary">{summary}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <TodayList rows={rows} />
      </Card>
    </section>
  );
}
