"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createId } from "@/shared/kernel/id";
import {
  archiveNotebook as archiveNotebookAction,
  archivePage as archivePageAction,
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

const SIDEBAR_TREE_QUERY_KEY = ["notebooks", "sidebar-tree"] as const;

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
  const { data: notebooks } = useQuery({
    queryKey: SIDEBAR_TREE_QUERY_KEY,
    queryFn: getSidebarTree,
    initialData: initialNotebooks,
  });

  function optimisticUpdate(
    updater: (previous: SidebarNotebook[]) => SidebarNotebook[],
  ): { previous: SidebarNotebook[] | undefined } {
    const previous = queryClient.getQueryData<SidebarNotebook[]>(
      SIDEBAR_TREE_QUERY_KEY,
    );
    queryClient.setQueryData<SidebarNotebook[]>(
      SIDEBAR_TREE_QUERY_KEY,
      (current) => updater(current ?? []),
    );
    return { previous };
  }

  function rollbackOn(previous: SidebarNotebook[] | undefined) {
    if (previous) queryClient.setQueryData(SIDEBAR_TREE_QUERY_KEY, previous);
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: SIDEBAR_TREE_QUERY_KEY });
  }

  const createNotebook = useMutation({
    mutationFn: (title: string) => createNotebookAction({ title }),
    onMutate: (title) => {
      const tempId = createId();
      const { previous } = optimisticUpdate((current) => [
        ...current,
        { id: tempId, title, icon: null, color: null, pages: [] },
      ]);
      return { previous, tempId };
    },
    // Patches the real id in immediately instead of waiting for the
    // background refetch (onSettled): otherwise a user who acts on the
    // freshly created notebook before that refetch resolves (rename, set
    // appearance, add a page) would still be targeting the temporary
    // client-only id, and the Server Action would reject it with
    // NOTEBOOK_NOT_FOUND.
    onSuccess: (created, _title, context) => {
      queryClient.setQueryData<SidebarNotebook[]>(
        SIDEBAR_TREE_QUERY_KEY,
        (current) =>
          (current ?? []).map((notebook) =>
            notebook.id === context?.tempId
              ? { ...notebook, id: created.id }
              : notebook,
          ),
      );
    },
    onError: (_error, _title, context) => rollbackOn(context?.previous),
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
    onError: (_error, _input, context) => rollbackOn(context?.previous),
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
    onError: (_error, _input, context) => rollbackOn(context?.previous),
    onSettled: invalidate,
  });

  const archiveNotebook = useMutation({
    mutationFn: (notebookId: string) => archiveNotebookAction({ notebookId }),
    onMutate: (notebookId) =>
      optimisticUpdate((previous) =>
        previous.filter((notebook) => notebook.id !== notebookId),
      ),
    onError: (_error, _notebookId, context) => rollbackOn(context?.previous),
    onSettled: invalidate,
  });

  const createPage = useMutation({
    mutationFn: (notebookId: string) => createPageAction({ notebookId }),
    onMutate: (notebookId) => {
      const tempId = createId();
      const { previous } = optimisticUpdate((current) =>
        current.map((notebook) =>
          notebook.id === notebookId
            ? {
                ...notebook,
                pages: [...notebook.pages, { id: tempId, title: "Sin título" }],
              }
            : notebook,
        ),
      );
      return { previous, tempId };
    },
    // Same reasoning as createNotebook.onSuccess: replace the temporary
    // page id with the real one right away so an immediate follow-up click
    // (e.g. opening the page) never targets an id the server never saw.
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
                      ? { ...page, id: created.id }
                      : page,
                  ),
                }
              : notebook,
          ),
      );
    },
    onError: (_error, _notebookId, context) => rollbackOn(context?.previous),
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
    onError: (_error, _input, context) => rollbackOn(context?.previous),
    onSettled: invalidate,
  });

  const archivePage = useMutation({
    mutationFn: (pageId: string) => archivePageAction({ pageId }),
    onMutate: (pageId) =>
      optimisticUpdate((previous) =>
        previous.map((notebook) => ({
          ...notebook,
          pages: notebook.pages.filter((page) => page.id !== pageId),
        })),
      ),
    onError: (_error, _pageId, context) => rollbackOn(context?.previous),
    onSettled: invalidate,
  });

  if (notebooks.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-3 py-4 text-center">
        <p className="text-fg-secondary text-sm">
          Aún no tienes cuadernos. Crea uno para empezar.
        </p>
        <CreateNotebookDialog
          onCreate={(title) => createNotebook.mutate(title)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3">
      <CreateNotebookDialog
        onCreate={(title) => createNotebook.mutate(title)}
      />
      <ul className="flex flex-col gap-1">
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
            onArchive={() => archiveNotebook.mutate(notebook.id)}
            onCreatePage={() => createPage.mutate(notebook.id)}
            onRenamePage={(pageId, title) =>
              renamePage.mutate({ pageId, title })
            }
            onArchivePage={(pageId) => archivePage.mutate(pageId)}
          />
        ))}
      </ul>
    </div>
  );
}
