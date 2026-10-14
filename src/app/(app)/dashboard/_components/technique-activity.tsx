"use client";

import { Brain, FileCheck, Layers, type LucideIcon } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/shared/ui/chart-card";
import { DotStreak } from "@/shared/ui/dot-streak";
import { IconTile, type IconTileProps } from "@/shared/ui/icon-tile";
import { Pill, type PillProps } from "@/shared/ui/pill";
import type { TechniqueCardView, TechniqueKey } from "../_lib/dashboard-view";

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

function figureLabel(metric: TechniqueCardView): string {
  const reviews =
    metric.reviewsCompleted === 1
      ? "1 repaso completado"
      : `${metric.reviewsCompleted} repasos completados`;
  const streak = `${metric.streakDays} día${metric.streakDays === 1 ? "" : "s"}`;
  const accuracy =
    metric.accuracyPct === null
      ? "sin resultados de acierto"
      : `${metric.accuracyPct}% de acierto`;
  return `Actividad de ${metric.label}: ${reviews} en el período, racha de ${streak}, ${accuracy}`;
}

function TechniqueCard({ metric }: { metric: TechniqueCardView }) {
  const Icon = TECHNIQUE_ICON[metric.key];
  const repasos = metric.reviewsCompleted;
  const isUp = metric.deltaPct !== null && metric.deltaPct >= 0;
  const accuracy = metric.accuracyPct === null ? "—" : `${metric.accuracyPct}%`;

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
      ariaLabel={figureLabel(metric)}
    >
      <div>
        <p className="text-[12px] text-fg-muted">Repasos completados</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-bold text-[22px] text-fg leading-none">
            {repasos}
          </span>
          {metric.deltaPct !== null && (
            <span
              className={
                isUp
                  ? "text-[11.5px] text-success-600"
                  : "text-[11.5px] text-error-600"
              }
            >
              {isUp ? "+" : ""}
              {metric.deltaPct}% vs {metric.periodLabel}
            </span>
          )}
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
            data={metric.recentActivity}
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
        {metric.recentActivity.map((day) => (
          <span key={day.day}>{day.label}</span>
        ))}
      </div>

      <Pill
        size="sm"
        tone={TECHNIQUE_PILL_TONE[metric.key]}
        className="self-start"
      >
        Acierto {accuracy}
      </Pill>
    </ChartCard>
  );
}

// Row 8 — "Actividad por técnica": one card per technique (reviews in the
// period vs. the previous one, streak with the last days of the period,
// the last 7 days' reviews and the period's accuracy), kept from v1 but
// simplified — no ring (that moved to the global `AccuracyRing` widget) and
// no "tiempo de estudio" (it can't be measured honestly).
export function TechniqueActivity({
  techniques,
}: {
  techniques: readonly TechniqueCardView[];
}) {
  return (
    <div
      data-testid="technique-activity"
      className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3"
    >
      {techniques.map((metric) => (
        <TechniqueCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}
