"use client";

import { Brain, FileCheck, Layers, type LucideIcon } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/shared/ui/chart-card";
import { DotStreak } from "@/shared/ui/dot-streak";
import { IconTile, type IconTileProps } from "@/shared/ui/icon-tile";
import { Pill, type PillProps } from "@/shared/ui/pill";
import {
  TECHNIQUE_METRICS,
  type TechniqueKey,
  type TechniqueMetric,
  techniqueRepasosCompletados,
} from "../_data/sample";

const DAY_LABELS = ["l", "m", "x", "j", "v", "s", "d"];

const TECHNIQUE_ICON: Record<TechniqueKey, LucideIcon> = {
  flashcards: Layers,
  activeRecall: Brain,
  exams: FileCheck,
};

const TECHNIQUE_TILE_TONE: Record<
  TechniqueKey,
  NonNullable<IconTileProps["tone"]>
> = {
  flashcards: "primary",
  activeRecall: "success",
  exams: "rose",
};

const TECHNIQUE_PILL_TONE: Record<
  TechniqueKey,
  NonNullable<PillProps["tone"]>
> = {
  flashcards: "primary",
  activeRecall: "success",
  exams: "rose",
};

function TechniqueCard({ metric }: { metric: TechniqueMetric }) {
  const Icon = TECHNIQUE_ICON[metric.key];
  const repasos = techniqueRepasosCompletados(metric);
  const isUp = metric.repasosDeltaPct >= 0;
  const activity = metric.weeklyActivity.map((count, i) => ({
    day: DAY_LABELS[i],
    count,
  }));

  return (
    <ChartCard
      icon={
        <IconTile
          size="30"
          radius="input"
          tone={TECHNIQUE_TILE_TONE[metric.key]}
        >
          <Icon aria-hidden="true" size={14} strokeWidth={1.75} />
        </IconTile>
      }
      title={metric.label}
      ariaLabel={`Actividad de ${metric.label}: ${repasos} repasos completados esta semana, racha de ${metric.streakDays} días, ${metric.accuracyPct}% de acierto`}
    >
      <div>
        <p className="text-[12px] text-fg-muted">Repasos completados</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-bold text-[22px] text-fg leading-none">
            {repasos}
          </span>
          <span
            className={
              isUp
                ? "text-[11.5px] text-success-600"
                : "text-[11.5px] text-error-600"
            }
          >
            {isUp ? "+" : ""}
            {metric.repasosDeltaPct}% vs la semana pasada
          </span>
        </div>
      </div>

      <DotStreak
        days={metric.studiedDays}
        streakDays={metric.streakDays}
        toneClassName={metric.dotClass}
      />

      <div className="h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={activity}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <Bar
              dataKey="count"
              radius={[3, 3, 0, 0]}
              fill={metric.colorVar}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[10px] text-fg-muted">
        {DAY_LABELS.map((label, i) => (
          <span key={`${metric.key}-${label}-${i}`}>{label}</span>
        ))}
      </div>

      <Pill
        size="sm"
        tone={TECHNIQUE_PILL_TONE[metric.key]}
        className="self-start"
      >
        Acierto {metric.accuracyPct}%
      </Pill>
    </ChartCard>
  );
}

// Row 8 — "Actividad por técnica": one card per technique, kept from v1 but
// simplified — no ring (that moved to the global `AccuracyRing` widget) and
// no "tiempo de estudio" (it can't be measured honestly yet).
export function TechniqueActivity() {
  return (
    <div
      data-testid="technique-activity"
      className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3"
    >
      {TECHNIQUE_METRICS.map((metric) => (
        <TechniqueCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}
