import Link from "next/link";
import type { HomeRecentPage } from "@/modules/notebooks";
import { Card } from "@/shared/ui/card";
import { SectionTitle } from "@/shared/ui/section-header";
import { cn } from "@/shared/ui/utils";
import { formatTimeAgo } from "../format";
import { NEUTRAL_DOT_CLASS, NOTEBOOK_DOT_CLASSES } from "../notebook-swatches";

interface RecentPagesProps {
  pages: HomeRecentPage[];
  now?: Date;
}

// ui_kits/app/Home Page.html .glass-panel/.page-row: the "Páginas
// recientes" panel. Only real pages (Product decision 1): no invented
// "flashcards pendientes" panel next to it.
export function RecentPages({ pages, now = new Date() }: RecentPagesProps) {
  return (
    <Card padding="md">
      <SectionTitle>Páginas recientes</SectionTitle>
      {pages.length === 0 ? (
        <p className="text-fg-muted text-sm">
          Todavía no hay páginas editadas.
        </p>
      ) : (
        <ul className="flex flex-col">
          {pages.map((page) => (
            <li
              key={page.id}
              className="border-border-subtle border-b last:border-b-0"
            >
              <Link
                href={`/notebooks/${page.notebookId}/pages/${page.id}`}
                className="flex items-center gap-2.5 rounded-md px-1 py-2 hover:bg-hover"
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
