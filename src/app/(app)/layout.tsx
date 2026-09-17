import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Sidebar } from "./_components/sidebar";
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
} from "./_components/sidebar-cookie";
import { Topbar } from "./_components/topbar";

// Authenticated shell. Session protection arrives with the middleware in PR3.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const collapsed =
    cookieStore.get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;

  return (
    <div className="flex h-dvh bg-canvas">
      <Sidebar initialCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col py-3 pr-3 pl-6">
        <div
          data-testid="content-area"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-content border border-border-subtle bg-page shadow-xs"
        >
          <Topbar />
          <main className="flex flex-1 flex-col overflow-auto p-(--content-padding)">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
