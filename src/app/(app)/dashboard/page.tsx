import { requireDesignPreviews } from "@/shared/config/design-previews";
import type { DashboardRange } from "@/shared/ui/period-filter";
import { Pill } from "@/shared/ui/pill";
import { SectionHeader } from "@/shared/ui/section-header";
import { SetBreadcrumb } from "../_components/breadcrumb";
import { AccuracyRing } from "./_components/accuracy-ring";
import { ActivityChart } from "./_components/activity-chart";
import { CalibrationTable } from "./_components/calibration-table";
import { Concepts } from "./_components/concepts";
import { DashboardHero } from "./_components/hero";
import { KpiRow } from "./_components/kpi-row";
import { MasteryInsight } from "./_components/mastery-insight";
import { NotebookProgress } from "./_components/notebook-progress";
import { TechniqueActivity } from "./_components/technique-activity";

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

// Dashboard v2 (design preview, design/shell-look): a focused,
// week-over-week progress dashboard — replaces the v1 "too many charts"
// layout (curva de dominio, mapa de dominio heatmap, stacked level bars,
// quadrant scatter, notebook filter all removed) with the reference
// screenshot's density: hero, key insight, one main activity chart, one
// accuracy ring, 3 KPI tiles, a notebook-progress list and a calibration
// table — monochrome charts, direct values, no colour-only meaning.
export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  requireDesignPreviews();
  const params = await searchParams;
  const range = parseRange(params.range);

  return (
    <section data-testid="dashboard" className="flex flex-1 flex-col gap-6">
      <SetBreadcrumb items={[{ label: "Dashboard" }]} />

      <SectionHeader
        eyebrow={
          <span className="flex items-center gap-2">
            Progreso
            <Pill size="sm" tone="neutral">
              Vista previa
            </Pill>
          </span>
        }
        title="Dashboard"
        titleClassName="text-[24px]"
        description={`Cómo vas en ${PERIOD_LABEL[range]}`}
      />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-[2fr_1fr]">
        <DashboardHero />
        <MasteryInsight />
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-[2fr_1fr]">
        <ActivityChart range={range} />
        <AccuracyRing />
      </div>

      <KpiRow />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-[1fr_2fr]">
        <NotebookProgress />
        <CalibrationTable />
      </div>

      <TechniqueActivity />

      <Concepts />
    </section>
  );
}
