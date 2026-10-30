import { Card } from "@/shared/ui/card";
import { TechniqueRing } from "@/shared/ui/technique-ring";
import type { TechniqueProgressView } from "../_lib/calendar-view";

export interface WeekSummaryProps {
  // Per technique, in items; null: the completed-reviews read failed.
  progress: readonly TechniqueProgressView[] | null;
}

// "Semana" metric card (Phase 8 H3-T2, user reviews 2026-10-19): "Progreso
// de la semana", one progress ring per technique (done / total items this
// week). From lg it fills a slot capped at the page header's height
// (`h-full`, clipped), so the header never moves between views.
export function WeekSummary({ progress }: WeekSummaryProps) {
  return (
    <Card
      asChild
      padding="none"
      className="flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden px-4 py-3 lg:h-full lg:px-3.5 lg:py-1.5"
    >
      <section aria-labelledby="week-progress-title" data-testid="week-metrics">
        <h3
          id="week-progress-title"
          className="font-semibold text-fg text-xs leading-tight"
        >
          Progreso de la semana
        </h3>
        {progress === null ? (
          <p className="text-fg-muted text-sm">No pudimos cargar tu progreso</p>
        ) : (
          <ul
            aria-label="Progreso de la semana"
            className="grid w-full min-w-0 grid-cols-3 gap-1"
          >
            {progress.map((row) => (
              <li key={row.tone} className="min-w-0">
                <TechniqueRing
                  tone={row.tone}
                  label={row.label}
                  done={row.done}
                  total={row.total}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
