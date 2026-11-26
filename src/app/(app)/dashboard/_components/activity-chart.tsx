"use client";

import { Activity } from "lucide-react";
import { useReducedMotion } from "motion/react";
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
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { type DashboardRange, PeriodFilter } from "@/shared/ui/period-filter";
import { Pill } from "@/shared/ui/pill";
import type { ActivityView, DailyActivity } from "../_lib/dashboard-view";

// One series per technique, in its own colour (user decision 2026-11-26):
// amber for flashcards, green for active recall, rose for exams. Each bar
// segment fills with a soft vertical gradient from `colorVar` to `fadeVar`;
// the legend and the tooltip use the solid `colorVar`, and both name the
// series, so the colour is never the only cue.
const SERIES = [
  {
    key: "flashcards",
    label: "Flashcards",
    colorVar: "var(--color-technique-flashcards-cta-edge)",
    fadeVar: "var(--color-technique-flashcards-accent)",
  },
  {
    key: "activeRecall",
    label: "Recordación activa",
    colorVar: "var(--color-success-500)",
    fadeVar: "var(--color-technique-recall-accent)",
  },
  {
    key: "exams",
    label: "Exámenes",
    colorVar: "var(--color-rose-500)",
    fadeVar: "var(--color-technique-exam-dot)",
  },
] as const;

const CONFIG: ChartConfig = Object.fromEntries(
  SERIES.map((series) => [
    series.key,
    { label: series.label, color: series.colorVar },
  ]),
);

const SERIES_COLOR: Record<string, string> = Object.fromEntries(
  SERIES.map((series) => [series.key, series.colorVar]),
);

// Entrance of the bars: the series rise one after another.
const BAR_ANIMATION_MS = 650;
const BAR_STAGGER_MS = 120;

function buildRangeHref(range: DashboardRange): string {
  return range === 7 ? "/dashboard" : `/dashboard?range=${range}`;
}

interface ActivityTickProps {
  x?: number;
  y?: number;
  index?: number;
  showEvery: number;
  // Display label per bar: the axis keys on the unique day ("2026-10-12"),
  // since a short label like "dom 1" can repeat within 30 days.
  labels: readonly string[];
}

// Custom XAxis tick (chart spec: 7 días shows every tick; 15/30 días shows
// a tick only every 5th day so labels never overlap at 30 bars).
function ActivityTick({
  x = 0,
  y = 0,
  index = 0,
  showEvery,
  labels,
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
      {labels[index]}
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
              style={{
                backgroundColor: SERIES_COLOR[String(item.dataKey)],
              }}
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

// Row 3 (wide) — "Actividad de repaso": the main chart. A stacked bar chart
// with one rounded segment per technique in the technique's colour (a
// named legend and tooltip back the colour), one bar per local day of the selected 7/15/30-day range (the
// analytics daily reviews), with a dashed weekly `ReferenceLine` so the
// chart reads day-by-day AND week-by-week at once. The comparison with the
// previous period only shows when that period had reviews; a period
// without reviews shows an empty state instead of empty bars.
export function ActivityChart({
  range,
  activity: { days, total, deltaPct, periodLabel },
}: {
  range: DashboardRange;
  activity: ActivityView;
}) {
  const isUp = deltaPct !== null && deltaPct >= 0;
  const weekBoundaries = range === 7 ? [] : days.filter((d) => d.isMonday);
  const labels = days.map((d) => d.label);
  const animate = !useReducedMotion();

  return (
    <div data-testid="activity-chart">
      <ChartCard
        icon={
          <IconTile size="36" radius="input" tone="primary">
            <Activity aria-hidden="true" size={16} strokeWidth={1.75} />
          </IconTile>
        }
        title="Actividad de repaso"
        divider
        ariaLabel="Repasos completados por día, desglosados por técnica"
        actions={
          deltaPct !== null && (
            <Pill size="sm" tone={isUp ? "success" : "error"}>
              {isUp ? "+" : ""}
              {deltaPct}%
            </Pill>
          )
        }
      >
        <div className="flex flex-col gap-1">
          <p className="text-[12px] text-fg-muted">Repasos completados</p>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-[26px] text-fg leading-none">
              {total}
            </span>
            {deltaPct !== null && (
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
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {SERIES.map((item) => (
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

        {total === 0 ? (
          <EmptyState
            variant="tinted"
            className="h-[220px]"
            icon={
              <IconTile size="36" radius="input" tone="neutral">
                <Activity aria-hidden="true" size={16} strokeWidth={1.75} />
              </IconTile>
            }
            title="Sin repasos en este período"
            titleAs="p"
            titleClassName="text-[13px]"
            description="Cuando repases, verás aquí tu actividad de cada día."
            descriptionClassName="text-[12px]"
          />
        ) : (
          <ChartContainer config={CONFIG} className="h-[220px]">
            <BarChart
              data={[...days]}
              margin={{ top: 8, right: 12, left: 12, bottom: 4 }}
            >
              <defs>
                {SERIES.map((series) => (
                  <linearGradient
                    key={series.key}
                    id={`activity-fill-${series.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={series.colorVar} />
                    <stop offset="100%" stopColor={series.fadeVar} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border-subtle)"
                strokeDasharray="3 3"
              />
              {weekBoundaries.map((day) => (
                <ReferenceLine
                  key={day.day}
                  x={day.day}
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
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tick={
                  <ActivityTick
                    showEvery={range === 7 ? 1 : 5}
                    labels={labels}
                  />
                }
              />
              <YAxis hide />
              <ChartTooltip
                content={ActivityTooltip}
                cursor={{ fill: "var(--color-primary-50)", radius: 8 }}
              />
              {SERIES.map((series, index) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  stackId="activity"
                  // Rounded segments with a card-coloured edge read as
                  // separate blocks stacked with a small gap.
                  radius={4}
                  stroke="var(--color-card)"
                  strokeWidth={1.5}
                  maxBarSize={44}
                  fill={`url(#activity-fill-${series.key})`}
                  isAnimationActive={animate}
                  animationBegin={index * BAR_STAGGER_MS}
                  animationDuration={BAR_ANIMATION_MS}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>
    </div>
  );
}
