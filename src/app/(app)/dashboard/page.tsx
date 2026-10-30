import { ArrowRight, BarChart3 } from "lucide-react";
import Link from "next/link";
import {
  dayKeyFormatter,
  getDashboardCalibration,
  getDashboardProgress,
  getDashboardTechniqueMetrics,
} from "@/modules/analytics";
import { getCurrentTimeZoneSetting, getCurrentUser } from "@/modules/identity";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import type { DashboardRange } from "@/shared/ui/period-filter";
import { SectionHeader } from "@/shared/ui/section-header";
import { StatusBanner } from "@/shared/ui/status-banner";
import { displayNameFromEmail } from "../_components/account-name";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { AccuracyRing } from "./_components/accuracy-ring";
import { ActivityChart } from "./_components/activity-chart";
import { CalibrationTable } from "./_components/calibration-table";
import { DashboardHero } from "./_components/hero";
import { KpiRow } from "./_components/kpi-row";
import { MasteryInsight } from "./_components/mastery-insight";
import { NotebookProgress } from "./_components/notebook-progress";
import { TechniqueActivity } from "./_components/technique-activity";
import {
  buildDashboardView,
  type DashboardView,
  dashboardRangeDays,
  hourIn,
} from "./_lib/dashboard-view";

const VALID_RANGES: readonly DashboardRange[] = [7, 15, 30];

function parseRange(value: string | string[] | undefined): DashboardRange {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return (VALID_RANGES as readonly number[]).includes(parsed)
    ? (parsed as DashboardRange)
    : 7;
}

const PERIOD_LABEL: Record<DashboardRange, string> = {
  7: "los últimos 7 días",
  15: "los últimos 15 días",
  30: "los últimos 30 días",
};

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// The progress read always carries a weekly quality trend; the dashboard
// shows none (no mastery history, T4 decision 2026-10-14), so it asks for
// the minimum.
const TREND_WEEKS = 1;

// Dashboard (documento-maestro §3.6, Phase 7 T4) on the analytics reads: a
// focused progress dashboard with the reference screenshot's density —
// hero, key insight, one main activity chart, one accuracy ring, 3 KPI
// tiles, a notebook-progress list, a calibration table and the per-
// technique cards; monochrome charts, direct values, no colour-only
// meaning. The zone comes from the profile, like the calendar, and one
// instant drives every read so "today" agrees across the page.
export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const [params, setting, user] = await Promise.all([
    searchParams,
    getCurrentTimeZoneSetting(),
    getCurrentUser(),
  ]);
  const range = parseRange(params.range);
  const { timeZone } = setting;
  const now = new Date();
  const days = dashboardRangeDays(dayKeyFormatter(timeZone)(now), range);
  const [progress, metrics, calibration] = await Promise.all([
    getDashboardProgress({ timeZone, weeks: TREND_WEEKS, now }),
    getDashboardTechniqueMetrics({ ...days, timeZone, now }),
    getDashboardCalibration({ ...days, timeZone }),
  ]);
  const view =
    progress.ok && metrics.ok && calibration.ok
      ? buildDashboardView({
          progress: progress.value,
          metrics: metrics.value,
          calibration: calibration.value,
          range,
          hour: hourIn(now, timeZone),
          userName: displayNameFromEmail(user?.email ?? null),
        })
      : null;

  return (
    <section data-testid="dashboard" className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Progreso" }]} />

      <SectionHeader
        eyebrow="Progreso"
        title="Progreso"
        titleClassName="text-[24px]"
        description={`Cómo vas en ${PERIOD_LABEL[range]}`}
      />

      {view === null ? (
        <StatusBanner
          role="alert"
          tone="error"
          title="No pudimos cargar tus métricas"
          description="Inténtalo de nuevo en un momento."
        />
      ) : view.isEmpty ? (
        <DashboardEmpty />
      ) : (
        <DashboardBody view={view} range={range} />
      )}
    </section>
  );
}

function DashboardEmpty() {
  return (
    <div data-testid="dashboard-empty" className="flex flex-1 flex-col">
      <EmptyState
        fill
        icon={
          <IconTile size="44" radius="tile" tone="neutral">
            <BarChart3 aria-hidden="true" size={20} strokeWidth={1.75} />
          </IconTile>
        }
        title="Aún no hay progreso que mostrar"
        description="Genera flashcards, preguntas o exámenes en tus páginas y repásalos para ver aquí cómo avanzas."
        action={
          <Button asChild className="mt-2">
            <Link href="/notebooks">
              Ir a mis cuadernos
              <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
            </Link>
          </Button>
        }
      />
    </div>
  );
}

function DashboardBody({
  view,
  range,
}: {
  view: DashboardView;
  range: DashboardRange;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-[2fr_1fr]">
        <DashboardHero hero={view.hero} />
        <MasteryInsight mastery={view.mastery} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-[2fr_1fr]">
        <ActivityChart range={range} activity={view.activity} />
        <AccuracyRing accuracy={view.accuracy} />
      </div>

      <KpiRow kpis={view.kpis} />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-[1fr_2fr]">
        <NotebookProgress rows={view.notebooks} />
        <CalibrationTable rows={view.calibration} />
      </div>

      <TechniqueActivity techniques={view.techniques} />
    </>
  );
}
