import { Brain, CalendarCheck, FileCheck, Layers } from "lucide-react";
import type { DueKind } from "@/modules/scheduling";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { ReviewRow } from "@/shared/ui/review-row";
import type { ReviewRow as ReviewRowView } from "../../calendario/_lib/today-rows";

const ICON: Record<DueKind, typeof Layers> = {
  flashcard: Layers,
  recall_question: Brain,
  exam_question: FileCheck,
};

const ICON_TONE = {
  yellow: "yellow",
  green: "mint",
  rose: "pink",
} as const;

// Home's "Repasar hoy" (Phase 8 H2-T5d, restyled in H2-T5n/T5o, user
// 2026-10-18): one tile per page and technique with items due today, the
// page that waited longest first. Each tile is a single link that opens
// that technique's session for the page: the technique's round icon, the
// page title in bold over its notebook and a chevron (count and technique
// name live in the link's aria-label). The heading is the Cogni violet,
// sentence case like the other Home headings (user 2026-10-18). On wide
// screens the card fills the right
// column exactly down to the end of the left column (it never sets the
// grid's height) and the list scrolls inside it when it is long. There the
// section clips (lg:overflow-hidden) and the list is the only scroller;
// the list's -m-1 p-1 gives the tiles' focus ring and hover lift room.
export function ReviewToday({ rows }: { rows: ReviewRowView[] | null }) {
  return (
    <section
      aria-labelledby="home-review-title"
      className="flex flex-col rounded-xl border border-border-subtle bg-card p-5 shadow-xs lg:absolute lg:inset-0 lg:overflow-hidden"
    >
      <h2
        id="home-review-title"
        className="shrink-0 font-bold text-[22px] text-primary-600 leading-tight tracking-[-0.015em]"
      >
        Repasar hoy
      </h2>
      <p className="mt-1.5 mb-4 shrink-0 text-pretty text-[13px] text-fg-secondary">
        Los repasos programados para hoy que aún tienes pendientes. Elige uno y
        empieza.
      </p>
      {rows === null ? (
        <p role="alert" className="shrink-0 text-[13px] text-fg-secondary">
          No pudimos cargar tus repasos. Inténtalo de nuevo en un momento.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="tinted"
          className="shrink-0 px-4 py-5"
          icon={
            <IconTile size="36" radius="input" tone="success">
              <CalendarCheck aria-hidden="true" size={18} strokeWidth={1.75} />
            </IconTile>
          }
          titleAs="p"
          title="No tienes repasos pendientes hoy"
          titleClassName="text-[15px]"
          description="Cuando una técnica tenga repasos para hoy, aparecerán aquí."
          descriptionClassName="text-[13px] text-fg-secondary"
        />
      ) : (
        <ul className="-m-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1">
          {rows.map((row) => {
            const Icon = ICON[row.kind];
            return (
              <li key={row.key}>
                <ReviewRow
                  layout="tile"
                  icon={
                    <IconTile
                      size="40"
                      tone={ICON_TONE[row.tone]}
                      radius="full"
                    >
                      <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                    </IconTile>
                  }
                  title={row.pageTitle}
                  meta={row.notebookTitle}
                  href={row.href}
                  actionLabel="Repasar"
                  actionAriaLabel={row.ariaLabel}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
