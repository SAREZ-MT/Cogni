import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { HomeReadyToReview } from "@/modules/notebooks";
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
    <div className="flex flex-col rounded-xl border border-border-subtle bg-card p-5 shadow-xs">
      <h2 className="mb-3.5 font-semibold text-fg text-sm">
        Notas listas para repasar
      </h2>
      {readyToReview.items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-success-500/20 bg-success-50 px-5 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-tile bg-success-100 text-success-600">
            <CheckCircle2 aria-hidden="true" size={20} strokeWidth={1.75} />
          </span>
          <p className="font-semibold text-fg text-sm">¡Todo al día!</p>
          <p className="text-fg-muted text-xs">
            No tienes notas pendientes de repaso por ahora.
          </p>
        </div>
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
    </div>
  );
}
