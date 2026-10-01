import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/shared/ui/card";
import { Sparkline, type SparklineTone } from "@/shared/ui/sparkline";
import { cn } from "@/shared/ui/utils";

export type KpiDeltaTone = "success" | "error" | "neutral";

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  // Preformatted delta text (e.g. "+4.2 pts", "−3 vencidos"). `direction`
  // picks the arrow glyph; `tone` picks the pill colour — kept separate so
  // an inverted metric (fewer vencidos is good) can show a down arrow in a
  // success pill.
  deltaLabel?: string;
  deltaDirection?: "up" | "down" | "flat";
  deltaTone?: KpiDeltaTone;
  sparklineData?: readonly number[];
  sparklineTone?: SparklineTone;
  className?: string;
  "data-testid"?: string;
}

const DELTA_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

const DELTA_PILL_CLASS: Record<KpiDeltaTone, string> = {
  success: "bg-success-100 text-success-700",
  error: "bg-error-100 text-error-700",
  neutral: "bg-neutral-150 text-fg-muted",
};

// KPI tile (chart spec §Widgets A): label, a 26/28-700 headline value, a
// delta pill vs. the previous period and a decorative Sparkline. Visual
// review fix (1024px layout): the label now truncates with a `title`
// fallback instead of wrapping onto the value, the value never wraps, and
// the delta pill moves below the value (its own line) below the `xl`
// breakpoint instead of squeezing next to a truncated label.
export function KpiCard({
  label,
  value,
  hint,
  deltaLabel,
  deltaDirection = "flat",
  deltaTone = "neutral",
  sparklineData,
  sparklineTone = "primary",
  className,
  "data-testid": testId,
}: KpiCardProps) {
  const DeltaIcon = DELTA_ICON[deltaDirection];

  const deltaPill = deltaLabel && (
    <span
      className={cn(
        "flex w-fit shrink-0 items-center gap-0.5 rounded-pill px-2 py-0.5 font-semibold text-[10.5px]",
        DELTA_PILL_CLASS[deltaTone],
      )}
    >
      <DeltaIcon aria-hidden="true" size={10} strokeWidth={2.5} />
      {deltaLabel}
    </span>
  );

  return (
    <Card
      padding="lg"
      className={cn("flex flex-col gap-2 xl:gap-3", className)}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          title={label}
          className="truncate font-medium text-[11.5px] text-fg-muted"
        >
          {label}
        </p>
        {deltaPill && (
          <span className="hidden shrink-0 xl:flex">{deltaPill}</span>
        )}
      </div>
      <p className="whitespace-nowrap font-bold text-[26px] text-fg leading-none xl:text-[28px]">
        {value}
      </p>
      {deltaPill && <span className="xl:hidden">{deltaPill}</span>}
      {hint && <p className="text-[11.5px] text-fg-muted">{hint}</p>}
      {sparklineData && sparklineData.length > 1 && (
        <Sparkline data={sparklineData} tone={sparklineTone} height={36} />
      )}
    </Card>
  );
}
