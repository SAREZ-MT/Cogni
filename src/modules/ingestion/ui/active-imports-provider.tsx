"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { getActiveImports } from "../actions";

// design.md, "Decision: Vista de página, llamada en curso y polling con
// TanStack Query", last paragraph: mounted in the composition root
// (src/app/(app)/_components/notebook-actions.tsx) with the initial ids of
// a server-side getActiveImports() call (src/app/(app)/layout.tsx), so the
// sidebar's ImportingPageBadge is correct on first paint. After that, this
// provider polls getActiveImports itself every POLL_INTERVAL_MS, but only
// while the cached list is non-empty. `add`/`remove` mutate the TanStack
// Query cache directly (queryClient.setQueryData) instead of separate local
// state: DocumentImportProvider calls add() right after startPdfImport succeeds
// (T13a) and PageImportView calls remove() once its own job reaches a
// terminal state, both giving an immediate, optimistic update instead of
// waiting up to POLL_INTERVAL_MS for the next tick — safe because the page
// id is already persisted server-side by the time either call happens.
export const ACTIVE_IMPORTS_QUERY_KEY = [
  "ingestion",
  "active-imports",
] as const;
const POLL_INTERVAL_MS = 2000;

interface ActiveImportsContextValue {
  pageIds: readonly string[];
  add: (pageId: string) => void;
  remove: (pageId: string) => void;
}

// Default (no provider mounted): nothing is ever "importing" and add/remove
// are no-ops, same default-context convention as
// notebooks/ui/notebook-actions-slot.tsx and
// ingestion/ui/document-import-provider.tsx, so DocumentImportProvider and
// PageImportView work standalone (and in their own tests) without this
// provider mounted.
const ActiveImportsContext = createContext<ActiveImportsContextValue>({
  pageIds: [],
  add: () => {},
  remove: () => {},
});

export function useIsImporting(pageId: string): boolean {
  const { pageIds } = useContext(ActiveImportsContext);
  return pageIds.includes(pageId);
}

export function useActiveImportsActions(): {
  add: (pageId: string) => void;
  remove: (pageId: string) => void;
} {
  const { add, remove } = useContext(ActiveImportsContext);
  return { add, remove };
}

export interface ActiveImportsProviderProps {
  initialPageIds: string[];
  children: ReactNode;
}

export function ActiveImportsProvider({
  initialPageIds,
  children,
}: ActiveImportsProviderProps) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ACTIVE_IMPORTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getActiveImports();
      // A query failure keeps the last known list and the next interval
      // retries, mirroring PageImportView's polling query.
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    // `initialData` is unconditional (always a real array, never derived
    // from component state), so `state.data` starts, and normally stays,
    // defined for this query — unlike PageImportView's polling query,
    // whose `initialData` is conditional on `state.phase`. It can still
    // become briefly undefined if the query is evicted from the cache
    // (e.g. `queryClient.removeQueries`/`clear()` from elsewhere), hence
    // the fallback: a rare eviction should stop polling, not throw.
    initialData: initialPageIds,
    refetchInterval: (activeQuery) =>
      (activeQuery.state.data?.length ?? 0) > 0 ? POLL_INTERVAL_MS : false,
    retry: false,
  });

  // Review follow-up from the T12+T13a slice
  // (R3-stale-closure-active-imports-mutations): `add`/`remove` used to
  // read `query.data` from the closure captured at the render that created
  // them (a plain read, defended above as always-defined). A caller that
  // still held an OLDER render's `add`/`remove` — bound before the cache
  // was refreshed by something else, such as a poll tick or another
  // add()/remove() — would then overwrite that other change with its own
  // stale snapshot, silently dropping it. `setQueryData`'s functional
  // updater receives TanStack's live cache value at call time instead of
  // this render's closure, so a stale caller can never regress the cache
  // to a state older than the one it is updating. `?? []` guards the same
  // rare-eviction case `query.data` was defended against above.
  function add(pageId: string): void {
    queryClient.setQueryData<string[]>(ACTIVE_IMPORTS_QUERY_KEY, (old = []) =>
      old.includes(pageId) ? old : [...old, pageId],
    );
  }

  function remove(pageId: string): void {
    queryClient.setQueryData<string[]>(ACTIVE_IMPORTS_QUERY_KEY, (old = []) =>
      old.filter((id) => id !== pageId),
    );
  }

  const value: ActiveImportsContextValue = {
    pageIds: query.data,
    add,
    remove,
  };

  return (
    <ActiveImportsContext.Provider value={value}>
      {children}
    </ActiveImportsContext.Provider>
  );
}
