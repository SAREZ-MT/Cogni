import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ensureProfileForUser, getCurrentUser } from "@/modules/identity";
import { getActiveImports } from "@/modules/ingestion";
import { BreadcrumbProvider } from "./_components/breadcrumb";
import { NotebookActions } from "./_components/notebook-actions";
import { QueryProvider } from "./_components/query-provider";
import { Sidebar } from "./_components/sidebar";
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
} from "./_components/sidebar-cookie";
import { Topbar } from "./_components/topbar";

// Authenticated shell. The proxy already redirects anonymous visitors; the
// check here is defence in depth for Server Functions and prefetches.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await ensureProfileForUser(user.id);

  const cookieStore = await cookies();
  const collapsed =
    cookieStore.get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;

  // T13a: initial ids the ImportingPageBadge slot needs, read server-side so
  // it is correct on first paint. Degrades to `[]` on failure
  // (getActiveImports's own withBoundary never throws). Design pass 2 (user
  // decision "Sidebar = navigation only"): the sidebar no longer renders the
  // notebook/page tree, so nothing currently consumes NotebookActionsSlot's
  // `pageBadge`/`menuItems` — NotebookActions keeps wrapping the main
  // content (instead of the sidebar) so the ingestion context stays wired
  // for a future page-card badge/menu, per "keep Server Actions and data
  // code intact; only move UI entry points."
  const activeImports = await getActiveImports();
  const initialActiveImportPageIds = activeImports.ok
    ? activeImports.value
    : [];

  return (
    <QueryProvider>
      <BreadcrumbProvider>
        {/* Shell canvas (design/shell-look, studyplatform obs 140): a flat
            8px gutter/gap around two floating cards, replacing the old
            edge-to-edge sidebar + asymmetric content padding. h-dvh (not
            min-h-screen, which the reference uses) is kept on purpose: the
            sidebar's and main's own overflow-y-auto/overflow-auto areas
            need a bounded height to scroll internally instead of growing
            the whole shell past the viewport. */}
        <div className="flex h-dvh gap-2 bg-canvas p-2">
          <Sidebar initialCollapsed={collapsed} user={user} />
          <div
            data-testid="content-area"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-card"
          >
            <Topbar user={user} />
            <main className="flex flex-1 flex-col overflow-auto p-(--content-padding)">
              <NotebookActions initialPageIds={initialActiveImportPageIds}>
                {children}
              </NotebookActions>
            </main>
          </div>
        </div>
      </BreadcrumbProvider>
    </QueryProvider>
  );
}
