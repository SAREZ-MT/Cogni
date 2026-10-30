"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createId } from "@/shared/kernel/id";
import { routeAfterDelete } from "@/shared/navigation/route-after-delete";
import {
  createNotebook as createNotebookAction,
  createPage as createPageAction,
  getSidebarTree,
  renameNotebook as renameNotebookAction,
  renamePage as renamePageAction,
  setNotebookAppearance as setNotebookAppearanceAction,
} from "../actions";
import type { SidebarNotebook } from "../application/list-sidebar";
import type { NotebookColor } from "../domain/notebook";
import { CreateNotebookDialog } from "./create-notebook-dialog";
import { NotebookItem } from "./notebook-item";
import { SIDEBAR_TREE_QUERY_KEY } from "./sidebar-tree-query-key";

interface SidebarTreeClientProps {
  initialNotebooks: SidebarNotebook[];
}

// Client half of the sidebar tree: hydrates the Server Component's snapshot
// as TanStack Query's initialData, then applies every mutation optimistic-
// ally with an onError rollback (design.md, "Sidebar como Server Component
// con mutaciones optimistas de TanStack Query").
export function SidebarTreeClient({
  initialNotebooks,
}: SidebarTreeClientProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { data: notebooks } = useQuery({
    queryKey: SIDEBAR_TREE_QUERY_KEY,
    queryFn: getSidebarTree,
    initialData: initialNotebooks,
  });

  interface OptimisticContext {
    previous: SidebarNotebook[] | undefined;
    applied: SidebarNotebook[];
  }

  function optimisticUpdate(
    updater: (previous: SidebarNotebook[]) => SidebarNotebook[],
  ): OptimisticContext {
    const previous = queryClient.getQueryData<SidebarNotebook[]>(
      SIDEBAR_TREE_QUERY_KEY,
    );
    // Keep the reference TanStack actually stored: structural sharing may
    // replace the array we pass in with a fresh copy, and rollbackOn compares
    // the cache against this exact reference.
    const applied =
      queryClient.setQueryData<SidebarNotebook[]>(
        SIDEBAR_TREE_QUERY_KEY,
        updater(previous ?? []),
      ) ?? [];
    return { previous, applied };
  }

  // A wholesale rollback to `context.previous` is only safe when nothing
  // else has touched the tree since this mutation applied its own
  // optimistic update: two mutations can be in flight at once (each with
  // its own onMutate snapshot), and restoring an older snapshot after a
  // sibling mutation already applied its own change would silently discard
  // that sibling's still-pending update.
  function rollbackOn(context: OptimisticContext | undefined) {
    if (!context?.previous) return;
    const current = queryClient.getQueryData<SidebarNotebook[]>(
      SIDEBAR_TREE_QUERY_KEY,
    );
    if (current === context.applied) {
      queryClient.setQueryData(SIDEBAR_TREE_QUERY_KEY, context.previous);
    }
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: SIDEBAR_TREE_QUERY_KEY });
  }

  // Home's stats/grid/recent pages are server-rendered (src/app/(app)/
  // inicio/page.tsx), so any mutation that changes them needs its own refresh to
  // stay in sync — but only while the user is actually looking at Home:
  // refreshing from another route (e.g. mid-edit on a page) would re-render
  // that route's Server Component for no reason.
  function refreshHomeIfActive() {
    if (pathname === "/inicio") router.refresh();
  }

  const createNotebook = useMutation({
    mutationFn: (title: string) => createNotebookAction({ title }),
    onMutate: (title) => {
      const tempId = createId();
      const context = optimisticUpdate((current) => [
        ...current,
        {
          id: tempId,
          title,
          icon: null,
          color: null,
          pages: [],
          pending: true,
        },
      ]);
      return { ...context, tempId };
    },
    // Patches the real id in immediately instead of waiting for the
    // background refetch (onSettled): otherwise a user who acts on the
    // freshly created notebook before that refetch resolves (rename, set
    // appearance, add a page) would still be targeting the temporary
    // client-only id, and the Server Action would reject it with
    // NOTEBOOK_NOT_FOUND. `pending` is cleared in the same update: until
    // then the notebook's own actions stay disabled (notebook-item.tsx) so
    // nothing can be triggered against the temporary id.
    onSuccess: (created, _title, context) => {
      queryClient.setQueryData<SidebarNotebook[]>(
        SIDEBAR_TREE_QUERY_KEY,
        (current) =>
          (current ?? []).map((notebook) =>
            notebook.id === context?.tempId
              ? { ...notebook, id: created.id, pending: false }
              : notebook,
          ),
      );
      // R3-sidebar-create-notebook-unconditional-refresh: Home's stats/grid
      // are server-rendered, so a notebook created from the sidebar needs
      // its own refresh, not only the sidebar tree's React Query cache
      // invalidation below — but, like every other mutation here, only
      // while the user is actually on Home.
      refreshHomeIfActive();
    },
    onError: (_error, _title, context) => rollbackOn(context),
    onSettled: invalidate,
  });

  const renameNotebook = useMutation({
    mutationFn: (input: { notebookId: string; title: string }) =>
      renameNotebookAction(input),
    onMutate: ({ notebookId, title }) =>
      optimisticUpdate((previous) =>
        previous.map((notebook) =>
          notebook.id === notebookId ? { ...notebook, title } : notebook,
        ),
      ),
    onSuccess: refreshHomeIfActive,
    onError: (_error, _input, context) => rollbackOn(context),
    onSettled: invalidate,
  });

  const setAppearance = useMutation({
    mutationFn: (input: {
      notebookId: string;
      icon: string | null;
      color: NotebookColor | null;
    }) => setNotebookAppearanceAction(input),
    onMutate: ({ notebookId, icon, color }) =>
      optimisticUpdate((previous) =>
        previous.map((notebook) =>
          notebook.id === notebookId ? { ...notebook, icon, color } : notebook,
        ),
      ),
    onError: (_error, _input, context) => rollbackOn(context),
    onSettled: invalidate,
  });

  const createPage = useMutation({
    mutationFn: (notebookId: string) => createPageAction({ notebookId }),
    onMutate: (notebookId) => {
      const tempId = createId();
      const context = optimisticUpdate((current) =>
        current.map((notebook) =>
          notebook.id === notebookId
            ? {
                ...notebook,
                pages: [
                  ...notebook.pages,
                  { id: tempId, title: "Sin título", pending: true },
                ],
              }
            : notebook,
        ),
      );
      return { ...context, tempId };
    },
    // Same reasoning as createNotebook.onSuccess: replace the temporary
    // page id with the real one right away so an immediate follow-up click
    // (e.g. opening the page) never targets an id the server never saw.
    // `pending` is cleared in the same update: until then the page renders
    // as a non-link (page-item.tsx) so it can't be navigated to yet.
    onSuccess: (created, notebookId, context) => {
      queryClient.setQueryData<SidebarNotebook[]>(
        SIDEBAR_TREE_QUERY_KEY,
        (current) =>
          (current ?? []).map((notebook) =>
            notebook.id === notebookId
              ? {
                  ...notebook,
                  pages: notebook.pages.map((page) =>
                    page.id === context?.tempId
                      ? { ...page, id: created.id, pending: false }
                      : page,
                  ),
                }
              : notebook,
          ),
      );
      refreshHomeIfActive();
    },
    onError: (_error, _notebookId, context) => rollbackOn(context),
    onSettled: invalidate,
  });

  const renamePage = useMutation({
    mutationFn: (input: { pageId: string; title: string }) =>
      renamePageAction(input),
    onMutate: ({ pageId, title }) =>
      optimisticUpdate((previous) =>
        previous.map((notebook) => ({
          ...notebook,
          pages: notebook.pages.map((page) =>
            page.id === pageId ? { ...page, title } : page,
          ),
        })),
      ),
    onSuccess: refreshHomeIfActive,
    onError: (_error, _input, context) => rollbackOn(context),
    onSettled: invalidate,
  });

  // Phase 8 H19: a delete already committed through its confirmation
  // dialog, so the tree drops the row at once and re-reads. On a route that
  // showed what was deleted, go to its parent (Cuadernos or the notebook);
  // elsewhere refresh the Server Components (hubs, Cuadernos, Inicio).
  function afterDelete(
    target: { notebookId: string; pageId?: string },
    drop: (current: SidebarNotebook[]) => SidebarNotebook[],
  ) {
    queryClient.setQueryData<SidebarNotebook[]>(
      SIDEBAR_TREE_QUERY_KEY,
      (current) => drop(current ?? []),
    );
    invalidate();
    const next = routeAfterDelete(pathname, target);
    if (next) router.push(next);
    else router.refresh();
  }

  // "Cuadernos" eyebrow + inline "+" trigger (design/shell-look, studyplatform
  // obs 142 PageTree): replaces the old full-width "Crear cuaderno" button.
  // Sits above both the empty state and the tree so it's always the single
  // way to create the first (or next) notebook. Same label classes as
  // sidebar.tsx's SectionLabel, replicated here to keep this module decoupled
  // from the app shell component.
  const header = (
    <div className="flex items-center justify-between px-2.5 pt-3.5 pb-1">
      <span className="font-medium text-[11px] text-fg-muted">Cuadernos</span>
      <CreateNotebookDialog
        onCreate={(title) => createNotebook.mutate(title)}
        trigger={
          <button
            type="button"
            aria-label="Crear cuaderno"
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors duration-200 ease-default hover:bg-hover hover:text-fg"
          >
            <Plus aria-hidden="true" size={14} strokeWidth={1.75} />
          </button>
        }
      />
    </div>
  );

  if (notebooks.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="px-2.5 text-fg-secondary text-sm">
          Aún no tienes cuadernos. Crea uno para empezar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {header}
      <ul className="flex flex-col gap-1 px-2.5">
        {notebooks.map((notebook) => (
          <NotebookItem
            key={notebook.id}
            notebook={notebook}
            onRename={(title) =>
              renameNotebook.mutate({ notebookId: notebook.id, title })
            }
            onSetAppearance={(icon, color) =>
              setAppearance.mutate({ notebookId: notebook.id, icon, color })
            }
            onDeleted={() =>
              afterDelete({ notebookId: notebook.id }, (current) =>
                current.filter((entry) => entry.id !== notebook.id),
              )
            }
            onCreatePage={() => createPage.mutate(notebook.id)}
            onRenamePage={(pageId, title) =>
              renamePage.mutate({ pageId, title })
            }
            onPageDeleted={(pageId) =>
              afterDelete({ notebookId: notebook.id, pageId }, (current) =>
                current.map((entry) => ({
                  ...entry,
                  pages: entry.pages.filter((page) => page.id !== pageId),
                })),
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}
