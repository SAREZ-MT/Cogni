import { getSidebarTree } from "../actions";
import { SidebarTreeClient } from "./sidebar-tree-client";

// Server Component: fetches the owner's active notebook/page tree once per
// request via the Server Action (design.md, "Sidebar como Server Component
// con mutaciones optimistas de TanStack Query"). The client component
// hydrates this as TanStack Query's initialData.
export async function SidebarTree() {
  const notebooks = await getSidebarTree();
  return <SidebarTreeClient initialNotebooks={notebooks} />;
}
