import { Notebook as NotebookIcon } from "lucide-react";
import Link from "next/link";
import {
  type HomeNotebookSummary,
  NotebookCardActions,
} from "@/modules/notebooks";
import { cn } from "@/shared/ui/utils";
import { formatTimeAgo } from "./format";
import {
  NEUTRAL_SWATCH_CLASS,
  NOTEBOOK_SWATCH_CLASSES,
} from "./notebook-swatches";

interface NotebookCardProps {
  notebook: HomeNotebookSummary;
  now?: Date;
}

// Shared by Home's "Mis cuadernos" grid and the /notebooks grid view
// (design pass 2: studyplatform-style-report.md §6/§7 describes a byte-
// identical card on both reference screens) — 44px pastel icon tile,
// title, page-count subtitle, footer with page count + time ago, hover
// lift. The card uses the "stretched link" pattern (the title Link's
// `after:absolute after:inset-0` covers the whole card) instead of wrapping
// the entire card in a Link, so the kebab menu's own button/dialogs can
// nest inside it without invalid `<button>`-inside-`<a>` markup; the kebab
// gets `relative z-10` so it still receives clicks above the stretched
// overlay regardless of DOM order.
export function NotebookCard({
  notebook,
  now = new Date(),
}: NotebookCardProps) {
  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border border-border-subtle bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-tile text-lg",
            notebook.color
              ? NOTEBOOK_SWATCH_CLASSES[notebook.color]
              : NEUTRAL_SWATCH_CLASS,
          )}
        >
          {notebook.icon ?? (
            <NotebookIcon aria-hidden="true" size={20} strokeWidth={1.75} />
          )}
        </span>
        <span className="relative z-10">
          <NotebookCardActions notebook={notebook} />
        </span>
      </div>
      <Link
        href={`/notebooks/${notebook.id}`}
        className="font-semibold text-fg text-sm after:absolute after:inset-0"
      >
        <span className="line-clamp-1">{notebook.title}</span>
      </Link>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-[11.5px] text-fg-muted">
          {notebook.pageCount === 1
            ? "1 página"
            : `${notebook.pageCount} páginas`}
        </span>
        <span className="text-[11px] text-fg-muted">
          {formatTimeAgo(notebook.updatedAt, now)}
        </span>
      </div>
    </article>
  );
}
