import { BookOpen, CheckCircle2, Play } from "lucide-react";
import Link from "next/link";
import type { NotebookColor } from "@/modules/notebooks";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { SectionTitle } from "@/shared/ui/section-header";
import { plural } from "../_lib/plural";

// One page with flashcards due now (scheduling's listDueToday, already in
// "waited longest first" order).
export interface DueTodayRow {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  // The notebook's color, already resolved (legacy notebooks fall back to
  // the hub's default tone).
  tone: NotebookColor;
  dueCount: number;
}

export interface DueTodayListProps {
  // null: the list could not be loaded.
  rows: readonly DueTodayRow[] | null;
}

// "Repasos de hoy" (documento-maestro §3.3, §3.5): the pages with flashcards
// due now, each opening its page deck straight into the graded review
// (`?repasar=1` starts DeckReview's session over that page's due cards).
// When nothing is due it says so with the success empty state.
export function DueTodayList({ rows }: DueTodayListProps) {
  return (
    <Card padding="md" className="flex flex-col" data-testid="due-today">
      <SectionTitle>Repasos de hoy</SectionTitle>
      {rows === null ? (
        <p className="text-fg-muted text-sm">
          No pudimos cargar tus repasos de hoy. Intenta de nuevo.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="success"
          icon={
            <IconTile size="40" tone="success">
              <CheckCircle2 aria-hidden="true" size={20} strokeWidth={1.75} />
            </IconTile>
          }
          title="Estás al día"
          titleAs="p"
          titleClassName="text-sm"
          description="No tienes tarjetas pendientes hoy. Vuelve cuando toque repasar."
          descriptionClassName="text-xs"
        />
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={row.pageId}
              data-testid="due-today-row"
              className="flex items-center gap-3 border-border-subtle border-b py-3 last:border-b-0"
            >
              <IconTile size="36" radius="input" tone={row.tone}>
                <BookOpen aria-hidden="true" size={17} strokeWidth={1.75} />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg text-sm">
                  {row.pageTitle}
                </span>
                <span className="block truncate text-fg-muted text-xs">
                  {row.notebookTitle}
                </span>
              </span>
              <Pill size="sm" tone="error" dot>
                {plural(row.dueCount, "pendiente", "pendientes")}
              </Pill>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/flashcards/${row.notebookId}/${row.pageId}?repasar=1`}
                  aria-label={`Repasar ${row.pageTitle}`}
                >
                  <Play aria-hidden="true" strokeWidth={2} />
                  Repasar
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
