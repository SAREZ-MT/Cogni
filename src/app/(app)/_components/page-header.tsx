import { Clock } from "lucide-react";
import type { ReactNode } from "react";
import { formatTimeAgo } from "./format";

interface PageHeaderProps {
  title: string;
  updatedAt: Date;
  // Injected instead of read internally with `new Date()`, so tests don't
  // depend on the real clock (same pattern as HomeHeader/NotebookGrid).
  now?: Date;
  // S5 (odd/tasks/app-shell-restyle.md): a slot for the editor's autosave
  // status, kept optional and unused by the real page route for now — see
  // that route's comment on why the status stays inside the editor's own
  // top row instead of being ported/duplicated here.
  statusSlot?: ReactNode;
}

// screenshots/editor.png, preview/type-scale.html: the page title reads as
// a large bold heading (h1: --text-3xl / 700 / --leading-tight) over a meta
// row that shows only real data (Product decision 1) — the page's own last
// edit time, plus an optional status slot for the autosave indicator.
export function PageHeader({
  title,
  updatedAt,
  now = new Date(),
  statusSlot,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="font-bold text-3xl text-fg leading-tight">{title}</h1>
      <div className="flex items-center gap-2 text-fg-muted text-xs">
        <span className="flex items-center gap-1">
          <Clock aria-hidden="true" size={14} strokeWidth={1.75} />
          Editada {formatTimeAgo(updatedAt, now)}
        </span>
        {statusSlot}
      </div>
    </header>
  );
}
