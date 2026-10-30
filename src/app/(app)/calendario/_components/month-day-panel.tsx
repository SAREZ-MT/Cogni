import { CalendarReviewCard } from "@/shared/ui/calendar-review-card";
import type { MonthDayPanelView, PanelReviewView } from "../_lib/calendar-view";

function ReviewList({
  label,
  items,
}: {
  label: string;
  items: readonly PanelReviewView[];
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.key}>
          <CalendarReviewCard
            href={item.href}
            tone={item.tone}
            title={item.title}
            detail={item.detail}
            techniqueLabel={item.techniqueLabel}
            aria-label={item.ariaLabel}
          />
        </li>
      ))}
    </ul>
  );
}

// The month's right panel (Phase 8 H3, approved mockup 2026-10-19): the
// selected day by name with its reviews, then — after a divider — the
// reviews of the seven days after it, flat, with no dates. Every card has
// the same fixed size.
export function MonthDayPanel({ panel }: { panel: MonthDayPanelView }) {
  const nextTitle = `Próximos repasos · ${panel.upcoming.length}`;
  return (
    <section
      aria-labelledby="month-day-title"
      className="flex min-w-0 flex-col gap-4"
    >
      <div>
        <h3
          id="month-day-title"
          className="font-semibold text-fg text-lg leading-tight"
        >
          {panel.title}
        </h3>
        <p className="mt-0.5 text-fg-muted text-sm">{panel.summary}</p>
      </div>
      {panel.rows.length > 0 && (
        <ReviewList label="Repasos del día" items={panel.rows} />
      )}
      <hr className="border-border-subtle" />
      <section
        aria-labelledby="month-next-title"
        className="flex flex-col gap-3"
      >
        <h4
          id="month-next-title"
          aria-label={nextTitle}
          className="font-semibold text-fg text-sm"
        >
          Próximos repasos
          <span className="font-normal text-fg-muted">
            {" · "}
            {panel.upcoming.length}
          </span>
        </h4>
        {panel.upcoming.length === 0 ? (
          <p className="text-fg-muted text-sm">Nada en los próximos 7 días</p>
        ) : (
          <ReviewList label="Próximos 7 días" items={panel.upcoming} />
        )}
      </section>
    </section>
  );
}
