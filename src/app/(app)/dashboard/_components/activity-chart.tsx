"use client";

import { Activity } from "lucide-react";
import type { TooltipContentProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/shared/ui/chart";
import { ChartCard } from "@/shared/ui/chart-card";
import { IconTile } from "@/shared/ui/icon-tile";
import { type DashboardRange, PeriodFilter } from "@/shared/ui/period-filter";
import { Pill } from "@/shared/ui/pill";
import { activityChartInsight, type DailyActivity } from "../_data/sample";

const CONFIG: ChartConfig = {
  flashcards: { label: "Flashcards", color: "var(--color-neutral-900)" },
  activeRecall: { label: "Active recall", color: "var(--color-neutral-500)" },
  exams: { label: "Exámenes", color: "var(--color-neutral-300)" },
};

const LEGEND_ITEMS = [
  {
    key: "flashcards",
    label: "Flashcards",
    colorVar: "var(--color-neutral-900)",
  },
  {
    key: "activeRecall",
    label: "Active recall",
    colorVar: "var(--color-neutral-500)",
  },
  { key: "exams", label: "Exámenes", colorVar: "var(--color-neutral-300)" },
] as const;

function buildRangeHref(range: DashboardRange): string {
  return range === 7 ? "/dashboard" : `/dashboard?range=${range}`;
}

interface ActivityTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string };
  index?: number;
  showEvery: number;
}

// Custom XAxis tick (chart spec: 7 días shows every tick; 15/30 días shows
// a tick only every 5th day so labels never overlap at 30 bars).
function ActivityTick({
  x = 0,
  y = 0,
  payload,
  index = 0,
  showEvery,
}: ActivityTickProps) {
  if (index % showEvery !== 0) return null;
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={11}
      fill="var(--color-neutral-400)"
    >
      {payload?.value}
    </text>
  );
}

function ActivityTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as DailyActivity | undefined;
  const total = payload.reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0,
  );

  return (
    <div className="min-w-[10rem] rounded-xl border border-border-subtle bg-card px-3 py-2 text-[12.5px] shadow-card">
      <p className="font-medium text-fg">{point?.fullLabel}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {payload.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
            <span className="flex-1 text-fg-muted">{item.name}</span>
            <span className="font-semibold text-fg tabular-nums">
              {item.value}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-border-subtle border-t pt-1">
          <span className="text-fg-muted">Total</span>
          <span className="font-semibold text-fg tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  );
}

// Row 3 (wide) — "Actividad de repaso": the main chart. A stacked, MONOCHROME
// bar chart (neutral-900/500/300 — never distinguishing series by hue
// alone), one bar per day for the selected 7/15/30-day range, with a
// dashed weekly `ReferenceLine` so the chart reads day-by-day AND
// week-by-week at once.
export function ActivityChart({ range }: { range: DashboardRange }) {
  const { days, total, deltaPct, periodLabel } = activityChartInsight(range);
  const isUp = deltaPct >= 0;
  const weekBoundaries = range === 7 ? [] : days.filter((d) => d.isMonday);

  return (
    <div data-testid="activity-chart">
      <ChartCard
        icon={
          <IconTile size="36" radius="input" tone="neutral">
            <Activity aria-hidden="true" size={16} strokeWidth={1.75} />
          </IconTile>
        }
        title="Actividad de repaso"
        divider
        ariaLabel="Repasos completados por día, desglosados por técnica"
        actions={
          <Pill size="sm" tone={isUp ? "success" : "error"}>
            {isUp ? "+" : ""}
            {deltaPct}%
          </Pill>
        }
      >
        <div className="flex flex-col gap-1">
          <p className="text-[12px] text-fg-muted">Repasos completados</p>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-[26px] text-fg leading-none">
              {total}
            </span>
            <span
              className={
                isUp
                  ? "text-[12px] text-success-600"
                  : "text-[12px] text-error-600"
              }
            >
              {isUp ? "+" : ""}
              {deltaPct}% vs {periodLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {LEGEND_ITEMS.map((item) => (
              <span key={item.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.colorVar }}
                />
                <span className="text-[11px] text-fg-muted">{item.label}</span>
              </span>
            ))}
          </div>
          <PeriodFilter value={range} hrefFor={buildRangeHref} />
        </div>

        <ChartContainer config={CONFIG} className="h-[220px]">
          <BarChart
            data={[...days]}
            margin={{ top: 8, right: 12, left: 12, bottom: 4 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border-subtle)"
              strokeDasharray="3 3"
            />
            {weekBoundaries.map((day) => (
              <ReferenceLine
                key={day.label}
                x={day.label}
                stroke="var(--color-border-default)"
                strokeDasharray="2 4"
                label={{
                  value: day.weekLabel,
                  position: "insideTopLeft",
                  fill: "var(--color-fg-muted)",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            ))}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={<ActivityTick showEvery={range === 7 ? 1 : 5} />}
            />
            <YAxis hide />
            <ChartTooltip
              content={ActivityTooltip}
              cursor={{ fill: "var(--color-neutral-100)" }}
            />
            <Bar
              dataKey="flashcards"
              name="Flashcards"
              stackId="activity"
              fill="var(--color-neutral-900)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="activeRecall"
              name="Active recall"
              stackId="activity"
              fill="var(--color-neutral-500)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="exams"
              name="Exámenes"
              stackId="activity"
              radius={[4, 4, 0, 0]}
              fill="var(--color-neutral-300)"
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
