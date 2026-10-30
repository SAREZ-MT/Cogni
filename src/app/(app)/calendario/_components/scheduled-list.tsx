import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { RevealGroup, RevealItem } from "@/shared/ui/reveal";
import { TodayReviewRow } from "@/shared/ui/today-review-row";
import { emptyCopy, type ScheduledRow } from "../_lib/today-list-rows";
import { CALENDAR_EMPTY_IMAGE, QuietLink } from "./empty-parts";

export interface ScheduledListProps {
  // null: the day's reviews could not be loaded.
  rows: readonly ScheduledRow[] | null;
  // The shown day's week, for the empty state's "Ver la semana".
  weekHref: string;
}

// Body of "Hoy" on a later day (Phase 8 H3-T4 day navigation): the reviews
// scheduled for that day, one row per page and technique in the
// `scheduled` look — no wait column, no "Repasar" and no done pill, since
// none of them is due yet; each row opens its page.
export function ScheduledList({ rows, weekHref }: ScheduledListProps) {
  if (rows === null) {
    return (
      <p className="px-6 py-8 text-fg-muted text-sm">
        No pudimos cargar los repasos de este día. Intenta de nuevo.
      </p>
    );
  }
  if (rows.length === 0) {
    const copy = emptyCopy("free-day");
    return (
      <IllustratedEmptyState
        image={CALENDAR_EMPTY_IMAGE}
        title={copy.title}
        description={copy.description}
        action={<QuietLink href={weekHref} label="Ver la semana" />}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-5 md:px-6 md:pb-6">
      <p className="text-fg-muted text-sm">
        Programados para este día · aún no toca repasarlos
      </p>
      <RevealGroup className="flex flex-col gap-3">
        {rows.map((row) => (
          <RevealItem key={row.key}>
            <TodayReviewRow
              data-testid="scheduled-row"
              scheduled
              href={row.href}
              aria-label={row.ariaLabel}
              tone={row.tone}
              title={row.pageTitle}
              techniqueLabel={row.techniqueLabel}
              notebookTitle={row.notebookTitle}
              amountLabel={row.amountLabel}
            />
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
