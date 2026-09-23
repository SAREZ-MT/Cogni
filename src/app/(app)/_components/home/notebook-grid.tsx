import { Notebook as NotebookIcon } from "lucide-react";
import Link from "next/link";
import {
  CreateNotebookTrigger,
  type HomeNotebookSummary,
  type NotebookColor,
} from "@/modules/notebooks";
import { cn } from "@/shared/ui/utils";
import { formatTimeAgo } from "../format";

// Tailwind (v4) needs literal class names to keep them in the generated
// CSS; a template-interpolated `bg-${color}` string is invisible to its
// scanner (same constraint as notebooks/ui/notebook-item.tsx's own
// SWATCH_CLASSES, duplicated here rather than shared across the module
// boundary: cross-module wiring only happens in this _components layer).
const SWATCH_CLASSES: Record<NotebookColor, string> = {
  pink: "bg-pastel-pink text-pastel-pink-fg",
  green: "bg-pastel-green text-pastel-green-fg",
  yellow: "bg-pastel-yellow text-pastel-yellow-fg",
  purple: "bg-pastel-purple text-pastel-purple-fg",
  orange: "bg-pastel-orange text-pastel-orange-fg",
  blue: "bg-pastel-blue text-pastel-blue-fg",
  mint: "bg-pastel-mint text-pastel-mint-fg",
};

interface NotebookGridProps {
  notebooks: HomeNotebookSummary[];
  now?: Date;
}

// ui_kits/app/Home Page.html .workspaces-grid: 3-column grid of notebook
// cards (44px pastel icon square, name, page count, time ago) with a
// dashed "Nuevo cuaderno" tile always last.
export function NotebookGrid({
  notebooks,
  now = new Date(),
}: NotebookGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3.5">
      {notebooks.map((notebook) => (
        <Link
          key={notebook.id}
          href={`/notebooks/${notebook.id}`}
          className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-lg text-lg",
              notebook.color
                ? SWATCH_CLASSES[notebook.color]
                : "bg-neutral-150 text-fg-secondary",
            )}
          >
            {notebook.icon ?? (
              <NotebookIcon aria-hidden="true" size={20} strokeWidth={1.75} />
            )}
          </span>
          <p className="truncate font-semibold text-fg text-sm">
            {notebook.title}
          </p>
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
        </Link>
      ))}
      <CreateNotebookTrigger variant="tile" />
    </div>
  );
}
