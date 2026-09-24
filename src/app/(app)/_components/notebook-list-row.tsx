import { ChevronRight, Notebook as NotebookIcon } from "lucide-react";
import Link from "next/link";
import {
  type HomeNotebookSummary,
  NotebookCardActions,
} from "@/modules/notebooks";
import { cn } from "@/shared/ui/utils";
import { formatTimeAgo } from "./format";
import { NOTEBOOK_SWATCH_CLASSES } from "./notebook-swatches";

interface NotebookListRowProps {
  notebook: HomeNotebookSummary;
  now?: Date;
}

// /notebooks list view (Notion/file-explorer style, per user decision):
// a full-width row per notebook with a divider, same stretched-link +
// kebab pattern as notebook-card.tsx.
export function NotebookListRow({
  notebook,
  now = new Date(),
}: NotebookListRowProps) {
  return (
    <div className="group relative flex items-center gap-3 border-border-subtle border-b px-3 py-3 last:border-b-0 hover:bg-hover">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md text-sm",
          // Legacy notebooks created before random colors were assigned on
          // creation have no stored color; fall back to violet rather than
          // a flat neutral tile (user decision, design pass 2).
          NOTEBOOK_SWATCH_CLASSES[notebook.color ?? "purple"],
        )}
      >
        {notebook.icon ?? (
          <NotebookIcon aria-hidden="true" size={15} strokeWidth={1.75} />
        )}
      </span>
      <Link
        href={`/notebooks/${notebook.id}`}
        className="min-w-0 flex-1 font-medium text-fg text-sm after:absolute after:inset-0"
      >
        <span className="block truncate">{notebook.title}</span>
      </Link>
      <span className="w-20 shrink-0 text-right text-[11.5px] text-fg-muted">
        {notebook.pageCount === 1
          ? "1 página"
          : `${notebook.pageCount} páginas`}
      </span>
      <span className="w-16 shrink-0 text-right text-[11px] text-fg-muted">
        {formatTimeAgo(notebook.updatedAt, now)}
      </span>
      <span className="relative z-10">
        <NotebookCardActions notebook={notebook} />
      </span>
      <ChevronRight
        aria-hidden="true"
        size={16}
        strokeWidth={1.75}
        className="shrink-0 text-fg-muted"
      />
    </div>
  );
}
