import { IllustratedEmptyState } from "@/shared/ui/illustrated-empty-state";
import { Pill } from "@/shared/ui/pill";
import { RevealGroup, RevealItem } from "@/shared/ui/reveal";
import { TodayReviewRow } from "@/shared/ui/today-review-row";
import { calendarHref } from "../_lib/calendar-view";
import {
  type EmptyCase,
  emptyCopy,
  type TodayRow,
} from "../_lib/today-list-rows";
import { CALENDAR_EMPTY_IMAGE, QuietLink } from "./empty-parts";

export interface TodayListProps {
  // null: the due list could not be loaded.
  rows: readonly TodayRow[] | null;
  // Today's study units done / total ("X de Y hechos hoy"); null hides it.
  progress: { label: string } | null;
  // Nothing left today: "done" (all reviewed) or "clear" (nothing was
  // due), and the next review day when one is known.
  empty: {
    kind: Exclude<EmptyCase, "free-day">;
    next: { href: string; label: string } | null;
  };
}

// Body of the calendar's "Hoy" tab (documento-maestro §3.5, Phase 8
// H3-T4): a helper line with today's progress pill, then one row per page
// and technique due, the one that has waited longest first, each opening
// that technique's session.
export function TodayList({ rows, progress, empty }: TodayListProps) {
  if (rows === null) {
    return (
      <p className="px-6 py-8 text-fg-muted text-sm">
        No pudimos cargar tus repasos de hoy. Intenta de nuevo.
      </p>
    );
  }
  if (rows.length === 0) {
    const copy = emptyCopy(empty.kind);
    return (
      <IllustratedEmptyState
        image={CALENDAR_EMPTY_IMAGE}
        title={copy.title}
        description={copy.description}
        action={
          <QuietLink
            href={empty.next?.href ?? calendarHref("semana")}
            label={empty.next?.label ?? "Ver la semana"}
          />
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-5 md:px-6 md:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fg-muted text-sm">
          Ordenados por el que lleva más tiempo esperando
        </p>
        {progress && (
          <Pill size="md" tone="primary">
            {progress.label}
          </Pill>
        )}
      </div>
      {/* The rows rise in one after another (instant under reduced
          motion). RevealItem renders a div, so the stack is not a <ul>. */}
      <RevealGroup className="flex flex-col gap-3">
        {rows.map((row) => (
          <RevealItem key={row.key}>
            <TodayReviewRow
              data-testid="today-row"
              href={row.href}
              aria-label={row.ariaLabel}
              tone={row.tone}
              title={row.pageTitle}
              waitingTitle={row.waiting.title}
              waitingDetail={row.waiting.detail}
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
