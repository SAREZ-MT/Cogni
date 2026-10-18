import type { HomeRecentPage } from "@/modules/notebooks";
import { ForgettingCurve } from "@/shared/ui/forgetting-curve";
import { PageLinkCard } from "@/shared/ui/page-link-card";
import { formatTimeAgo } from "../format";

export type ContinueReadingPage = HomeRecentPage;

// Compact on purpose: it sits under "Para repasar hoy" in the main column.
const MAX_PAGES = 4;
const HOUR_MS = 60 * 60 * 1000;

function titleOf(page: ContinueReadingPage): string {
  return page.title.trim() === "" ? "Sin título" : page.title;
}

// Home's "Continúa donde lo dejaste" (Phase 8 H2-T5h), the promise the
// empty Home makes: the most recently edited pages (notebooks'
// getHomeOverview().recentPages, newest first), each a compact card that
// opens the page's editor. Two columns on wide screens, stacked below.
// Each card carries the forgetting curve (H2-T5r, user 2026-10-18) with
// "now" placed by the hours since the page was last edited. No visible
// notebook (H2-T5s, user 2026-10-18): the title sits at the top so the
// curve has room; the notebook stays in the link's accessible name.
export function ContinueReading({
  pages,
  now,
}: {
  pages: readonly ContinueReadingPage[];
  now: Date;
}) {
  const shown = pages.slice(0, MAX_PAGES);
  return (
    <section aria-labelledby="home-recent-title" className="flex flex-col">
      <h2
        id="home-recent-title"
        className="mb-3.5 font-semibold text-[17px] text-fg tracking-[-0.01em]"
      >
        Continúa donde lo dejaste
      </h2>
      {shown.length === 0 ? (
        <p className="text-[13px] text-fg-secondary">
          Aún no abriste ninguna página.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {shown.map((page) => {
            const title = titleOf(page);
            const ago = formatTimeAgo(page.updatedAt, now);
            const elapsedHours =
              (now.getTime() - page.updatedAt.getTime()) / HOUR_MS;
            return (
              <li key={page.id} className="min-w-0">
                <PageLinkCard
                  href={`/notebooks/${page.notebookId}/pages/${page.id}`}
                  title={title}
                  trailing={`Editada ${ago}`}
                  backdrop={<ForgettingCurve elapsedHours={elapsedHours} />}
                  titleClassName="pl-7"
                  ariaLabel={`Abrir ${title} de ${page.notebookTitle}, editada ${ago}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
