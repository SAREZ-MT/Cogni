import {
  MASTERY_LEVEL_LABEL,
  MASTERY_LEVEL_SOLID_CLASS,
  MASTERY_LEVELS,
  type MasteryLevel,
} from "@/shared/ui/mastery-level";
import { cn } from "@/shared/ui/utils";

export interface LevelStripBar {
  id: string;
  label: string;
  level: MasteryLevel;
  score: number; // 0-1
}

export interface LevelStripProps {
  bars: readonly LevelStripBar[];
  className?: string;
}

// Dashboard v2 "Dominio global" key-insight strip: one thin 3px-wide bar
// per page, sorted by score outside this atom, height proportional to
// score and coloured by `mastery-level.ts`'s single solid-tone scale — the
// reference screenshot's dense vertical-bar sparkline, kept monochrome-per-
// level instead of a single gradient so a glance still reads "how many
// pages at each level" via colour. A `group`-hover/focus tooltip (page ·
// nivel · score, same pattern `MasteryHeatmap` used) keeps this
// server-renderable — no JS mouse tracking.
export function LevelStrip({ bars, className }: LevelStripProps) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div
        role="img"
        aria-label={`Dominio por página: ${bars.length} páginas`}
        className="flex h-10 items-end gap-[3px]"
      >
        {bars.map((bar) => (
          <div key={bar.id} className="group/bar relative flex-1">
            <span
              aria-hidden="true"
              className={cn(
                "block w-full rounded-[1.5px]",
                MASTERY_LEVEL_SOLID_CLASS[bar.level],
              )}
              style={{ height: `${Math.max(6, Math.round(bar.score * 40))}px` }}
            />
            <div className="-translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-max max-w-[200px] rounded-lg border border-border-subtle bg-card px-2.5 py-1.5 text-[12px] shadow-card group-hover/bar:block group-focus-within/bar:block">
              <p className="font-medium text-fg">{bar.label}</p>
              <p className="text-fg-muted">
                {MASTERY_LEVEL_LABEL[bar.level]} · {Math.round(bar.score * 100)}
                %
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {MASTERY_LEVELS.filter((level) => level !== "nuevo").map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                MASTERY_LEVEL_SOLID_CLASS[level],
              )}
            />
            <span className="text-[11px] text-fg-muted">
              {MASTERY_LEVEL_LABEL[level]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
