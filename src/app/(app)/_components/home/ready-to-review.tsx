import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { HomeReadyToReview } from "@/modules/notebooks";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { SectionTitle } from "@/shared/ui/section-header";
import { cn } from "@/shared/ui/utils";
import { formatTimeAgo } from "../format";
import { NEUTRAL_DOT_CLASS, NOTEBOOK_DOT_CLASSES } from "../notebook-swatches";

interface ReadyToReviewProps {
  readyToReview: HomeReadyToReview;
  now?: Date;
}

// Home two-column row, left card (Home study-metrics decisions): top 3
// pages ready to review, each with a "Repasar" ghost link. Empty state
// reuses figma-make-design-system.md Patterns "Success state" (the green
// success tokens) instead of the violet empty-state pattern — there is
// nothing left to do, which is good news.
export function ReadyToReview({
  readyToReview,
  now = new Date(),
}: ReadyToReviewProps) {
  return (
    <Card padding="md" className="flex flex-col">
      <SectionTitle>Notas listas para repasar</SectionTitle>
      {readyToReview.items.length === 0 ? (
        <EmptyState
          variant="success"
          fill
          icon={
            <IconTile size="40" tone="success">
              <CheckCircle2 aria-hidden="true" size={20} strokeWidth={1.75} />
            </IconTile>
          }
          title="¡Todo al día!"
          titleAs="p"
          titleClassName="text-sm"
          description="No tienes notas pendientes de repaso por ahora."
          descriptionClassName="text-xs"
        />
      ) : (
        <ul className="flex flex-col">
          {readyToReview.items.map((page) => (
            <li
              key={page.id}
              className="flex items-center gap-2.5 border-border-subtle border-b py-2.5 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  page.notebookColor
                    ? NOTEBOOK_DOT_CLASSES[page.notebookColor]
                    : NEUTRAL_DOT_CLASS,
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[13px] text-fg">
                  {page.title}
                </span>
                <span className="block truncate text-[11px] text-fg-muted">
                  {page.notebookTitle}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-fg-muted">
                {formatTimeAgo(page.updatedAt, now)}
              </span>
              <Link
                href={`/notebooks/${page.notebookId}/pages/${page.id}`}
                className="shrink-0 rounded-input px-2 py-1 font-medium text-[11.5px] text-primary-600 hover:bg-primary-50"
              >
                Repasar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
