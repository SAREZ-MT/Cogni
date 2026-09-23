"use client";

import { createContext, type ReactNode, useContext } from "react";

// design.md, "Decision: Menu de acciones del cuaderno con slot inyectado
// desde la raiz de composicion" — `notebooks` cannot import `ingestion`
// (`cross-module-via-index` in .dependency-cruiser.cjs forbids reaching
// past a module's public index.ts), and a Server Component cannot pass a
// render function to a Client Component as a prop. The composition root
// (src/app/(app)/_components/notebook-actions.tsx, added in a later task)
// mounts `NotebookActionsSlotProvider` above `<SidebarTree />` to inject
// `ingestion`'s menu entry and badge through this context instead.
//
// Default (no provider mounted, or a provider with an unset prop): no
// injected menu items and no badge, so every consumer (NotebookItem,
// PageItem, their tests) works standalone without a provider.

export interface NotebookActionsSlotTarget {
  id: string;
  title: string;
}

export interface PageActionsSlotTarget {
  id: string;
}

export interface NotebookActionsHelpers {
  // Invalidates the sidebar tree query so an injected action's side effect
  // (e.g. a page created by a PDF import) appears without a full reload.
  // The query key itself stays private to `notebooks` (not exported here):
  // callers only get this closure.
  refreshTree: () => void;
}

export interface NotebookActionsSlotValue {
  menuItems?: (
    notebook: NotebookActionsSlotTarget,
    helpers: NotebookActionsHelpers,
  ) => ReactNode;
  pageBadge?: (page: PageActionsSlotTarget) => ReactNode;
}

const NotebookActionsSlotContext = createContext<NotebookActionsSlotValue>({});

interface NotebookActionsSlotProviderProps extends NotebookActionsSlotValue {
  children: ReactNode;
}

export function NotebookActionsSlotProvider({
  children,
  menuItems,
  pageBadge,
}: NotebookActionsSlotProviderProps) {
  return (
    <NotebookActionsSlotContext.Provider value={{ menuItems, pageBadge }}>
      {children}
    </NotebookActionsSlotContext.Provider>
  );
}

export function useNotebookActionsSlot(): NotebookActionsSlotValue {
  return useContext(NotebookActionsSlotContext);
}
