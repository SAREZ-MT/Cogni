import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ensureProfileForUser, getCurrentUser } from "@/modules/identity";
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
