import {
  DeletePageButton,
  type NotebookColor,
  type Page,
} from "@/modules/notebooks";
import { PageStripRow } from "@/shared/ui/page-strip";
import { formatUpdatedAt } from "./format";

interface PageListRowProps {
  page: Page;
  notebookId: string;
  // The notebook's colour for the strip's tab and margin rule; null or
  // omitted falls back to violet.
  tone?: NotebookColor | null;
}

// notebookId/page.tsx list view. Phase 8 H5-T2 (user request 2026-10-29):
// each page is a `PageStripRow` paper strip in the sheets' family, with the
// "Actualizada {d MMM}" date and the delete action (Phase 8 H19) always
// visible.
export function PageListRow({ page, notebookId, tone }: PageListRowProps) {
  return (
    <PageStripRow
      href={`/notebooks/${notebookId}/pages/${page.id}`}
      title={page.title}
      datePrefix="Actualizada"
      dateLabel={formatUpdatedAt(page.updatedAt)}
      tone={tone}
      actions={<DeletePageButton pageId={page.id} title={page.title} />}
    />
  );
}
