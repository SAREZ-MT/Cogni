import Link from "next/link";
import type { HomeRecentPage } from "@/modules/notebooks";
import { formatTimeAgo } from "./format";

interface RecentPagesProps {
  pages: HomeRecentPage[];
  now?: Date;
}

// ui_kits/app/Home Page.html .glass-panel/.page-row: the "Páginas
// recientes" panel. Only real pages (Product decision 1): no invented
// "flashcards pendientes" panel next to it.
export function RecentPages({ pages, now = new Date() }: RecentPagesProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card p-5 shadow-xs">
      <h2 className="mb-3.5 font-semibold text-fg text-sm">
        Páginas recientes
      </h2>
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
    </div>
  );
}
