import { BookOpen, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { TechniqueChip } from "@/shared/ui/technique-chip";
import type { TodayRow } from "../_lib/today-rows";

export interface TodayListProps {
  // null: the due list could not be loaded.
  rows: readonly TodayRow[] | null;
}

// Body of the calendar's "Hoy" tab (documento-maestro §3.5): one row per
// page with study items due now — page and notebook on the left, one
// technique-coloured chip per technique on the right, each opening that
// technique's session for the page.
export function TodayList({ rows }: TodayListProps) {
  if (rows === null) {
    return (
      <p className="px-6 py-8 text-fg-muted text-sm">
        No pudimos cargar tus repasos de hoy. Intenta de nuevo.
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        variant="plain"
        className="px-6 py-14"
        icon={
          <IconTile size="44" radius="input" tone="success">
            <CheckCircle2 aria-hidden="true" size={22} strokeWidth={1.75} />
          </IconTile>
        }
        title="Estás al día"
        titleAs="p"
        titleClassName="text-base"
        description="No tienes repasos pendientes hoy. Vuelve cuando toque repasar."
        descriptionClassName="max-w-[340px]"
      />
    );
  }
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li
          key={row.pageId}
          data-testid="today-row"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-border-subtle border-b px-6 py-3.5 last:border-b-0"
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <IconTile size="36" radius="input" tone={row.notebookTone}>
              <BookOpen aria-hidden="true" size={17} strokeWidth={1.75} />
            </IconTile>
            <span className="min-w-0">
              <span className="block truncate font-medium text-fg text-sm">
                {row.pageTitle}
              </span>
              <span className="block truncate text-fg-muted text-xs">
                {row.notebookTitle}
              </span>
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {row.chips.map((chip) => (
              <TechniqueChip
                key={chip.kind}
                tone={chip.tone}
                label={chip.label}
                meta={chip.count}
                href={chip.href}
                aria-label={chip.ariaLabel}
                className="min-w-[120px]"
              />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
