import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { ArchivePageButton, type Page } from "@/modules/notebooks";
import { IconTile } from "@/shared/ui/icon-tile";
import { formatUpdatedAt } from "./format";

interface PageListRowProps {
  page: Page;
  notebookId: string;
}

// notebookId/page.tsx list view (Notion/file-explorer style): a full-width row per page with a divider, same
// stretched-link + hover-revealed action pattern as the page-card grid.
export function PageListRow({ page, notebookId }: PageListRowProps) {
  return (
    <div className="group relative flex items-center gap-3 border-border-subtle border-b px-3 py-3 last:border-b-0 hover:bg-hover">
      <IconTile size="28" radius="md" className="text-sm" tone="primary">
        <FileText aria-hidden="true" size={15} strokeWidth={1.75} />
      </IconTile>
      <Link
        href={`/notebooks/${notebookId}/pages/${page.id}`}
        className="min-w-0 flex-1 font-medium text-fg text-sm after:absolute after:inset-0"
      >
        <span className="block truncate">{page.title}</span>
      </Link>
      <span className="shrink-0 text-right text-[11.5px] text-fg-muted">
        Actualizada {formatUpdatedAt(page.updatedAt)}
      </span>
      <span className="relative z-10">
        <ArchivePageButton pageId={page.id} title={page.title} />
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
