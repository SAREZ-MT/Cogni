import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ensureProfileForUser, getCurrentUser } from "@/modules/identity";
import { getActiveImports } from "@/modules/ingestion";
import { CreateNotebookIconButton, SidebarTree } from "@/modules/notebooks";
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

  // T13a: initial ids for the sidebar's ImportingPageBadge, read
  // server-side so the badge is correct on first paint. Degrades to `[]`
  // on failure (getActiveImports's own withBoundary never throws): a
  // missing badge on first paint is not worth a broken shell, and
  // ActiveImportsProvider's own polling will pick it up shortly after.
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
          <Sidebar
            initialCollapsed={collapsed}
            collapsedCreateAction={<CreateNotebookIconButton />}
            user={user}
          >
            <NotebookActions initialPageIds={initialActiveImportPageIds}>
              <SidebarTree />
            </NotebookActions>
          </Sidebar>
          <div
            data-testid="content-area"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-card"
          >
            <Topbar user={user} />
            <main className="flex flex-1 flex-col overflow-auto p-(--content-padding)">
              {children}
            </main>
          </div>
        </div>
      </BreadcrumbProvider>
    </QueryProvider>
  );
}
